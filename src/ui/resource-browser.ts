import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { Errorable, failed } from '../utils/errorable';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        return new GatekeeperNodeContributor(kubectl);

        // Real world:
        // * A ConstraintTemplate contains:
        //   + spec
        //     + crd
        //       (normal CRD stuff like names and validation)
        //     + targets
        //       + array of { target, rego }
        //
        // This creates a CRD with the following definition:
        // apiVersion: constraints.gatekeeper.sh/v1beta1  // TODO: confirm
        // kind: {{ .spec.crd.spec.names.kind }}
        // spec:
        //   match:
        //     kinds:
        //       - array of { apiGroups, kinds, ?more? }
        //       ?anything else?
        //     parameters:
        //       (as defined by the schema in .spec.crd.spec.validation.openAPIV3Schema)
        //
        // Then a *constraint* (that uses the template) is an *instance* of the CRD
        // (under the apiVersion constraints.gatekeeper.sh/v1beta1? or is that just the
        // default is /spec/crd doesn't specify an apiVersion?)

        // So... how do we render this?  E.g.
        // + Gatekeeper
        //   + RequiredLabels  // NOTE: metadata.name is k8srequiredlabels - do we prefer this or the .spec.names.kind as shown
        //     + ns-must-have-gk
        //     + deployment-must-have-git-tag
        //   + ApprovedImages
        //     + images-must-be-from-private-registry
        //     + images-must-not-be-latest
        // TODO: Should we show a list of constraint templates as leaf items?
        // TODO: Should we show the constraints as a flat list?
        // TODO: Should we show the gatekeeper-system/config resource as a special editable thing?

        // TODO: how does this all work with namespaces?  (The samples all deploy into the current
        // (or default?) NS - what does it mean to have a constraint template or constraint in a
        // different NS?)

        // AUDIT
        // Audit results are stored in the status field of the constraint instance:
        // .status.violations (there is a .status.auditTimestamp for when).

        // TODO: ELSEWHERE: deploy for DRY RUN
        // - create the constraint instance with .spec.enforcementAction: dryrun
        // (default is deny)
        // - then you get audits but no actual prevention
        // RELATED: turn debug on via the config resource (gatekeeper-system/config)
        // https://github.com/open-policy-agent/gatekeeper#debugging

        // TODO: there is also a sync section in the GK config (gatekeeper-system/config)
        // which brings data into OPA for policies that need to look across multiple resources.
        // https://github.com/open-policy-agent/gatekeeper#replicating-data
    }
}

class GatekeeperNodeContributor implements k8s.ClusterExplorerV1.NodeContributor {
    constructor(private readonly kubectl: k8s.KubectlV1) { }
    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'context';
    }
    async getChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        if (this.contributesChildren(parent)) {
            return [new GatekeeperFolderNode(this.kubectl)];
        }
        return [];
    }
}

class GatekeeperFolderNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly kubectl: k8s.KubectlV1) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const constraintTemplates = await listConstraintTemplates(this.kubectl);
        if (failed(constraintTemplates)) {
            return [new ErrorNode(constraintTemplates.error[0])];
        }
        return constraintTemplates.result.map((ct) => new ConstraintTemplateNode(this.kubectl, ct));
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem("Gatekeeper", vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class ConstraintTemplateNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly template: ConstraintTemplateInfo) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const constraints = await listConstraints(this.kubectl, this.template.name);
        if (failed(constraints)) {
            return [new ErrorNode(constraints.error[0])];
        }
        return constraints.result.map((c) => new ConstraintNode(c));
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.template.name, vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class ConstraintNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly instance: ConstraintInfo) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.instance.name, vscode.TreeItemCollapsibleState.None);
    }
}

interface ConstraintTemplateInfo {
    readonly name: string;
}

interface ConstraintInfo {
    readonly name: string;
}

async function listConstraintTemplates(kubectl: k8s.KubectlV1): Promise<Errorable<ConstraintTemplateInfo[]>> {
    const sr = await kubectl.invokeCommand('get constrainttemplates -o json');
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const templatesListResource = JSON.parse(sr.stdout);
    const templates = templatesListResource.items as any[];
    const templatesInfo = templates.map((t) => ({ name: t.metadata.name }));
    return { succeeded: true, result: templatesInfo };
}

async function listConstraints(kubectl: k8s.KubectlV1, templateName: string): Promise<Errorable<ConstraintInfo[]>> {
    const sr = await kubectl.invokeCommand(`get ${templateName} -o json`);
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const constraintsListResource = JSON.parse(sr.stdout);
    const constraints = constraintsListResource.items as any[];
    const constraintsInfo = constraints.map((c) => ({ name: c.metadata.name }));
    return { succeeded: true, result: constraintsInfo };
}

class ErrorNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly diagnostic: string) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Error', vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.diagnostic;
        return treeItem;
    }
}
