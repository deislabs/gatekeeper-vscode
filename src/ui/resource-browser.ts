import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { failed } from '../utils/errorable';
import { listConstraintTemplates, ConstraintTemplateInfo, listConstraints, ConstraintInfo } from '../gatekeeper';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1): k8s.ClusterExplorerV1.NodeContributor {
        return new GatekeeperNodeContributor(kubectl);

        // So... how do we render the Gatekeeper stuff?  E.g.
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
