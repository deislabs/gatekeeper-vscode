import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { failed } from '../utils/errorable';
import { listConstraintTemplates, ConstraintTemplateInfo, listConstraints, ConstraintInfo, ConstraintStatus } from '../gatekeeper';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        return new GatekeeperNodeContributor(kubectl, extensionContext);

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
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext) { }
    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'context';
    }
    async getChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        if (this.contributesChildren(parent)) {
            return [new GatekeeperFolderNode(this.kubectl, this.extensionContext)];
        }
        return [];
    }
}

class GatekeeperFolderNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const constraintTemplates = await listConstraintTemplates(this.kubectl);
        if (failed(constraintTemplates)) {
            return [new ErrorNode(constraintTemplates.error[0])];
        }
        return constraintTemplates.result.map((ct) => new ConstraintTemplateNode(this.kubectl, this.extensionContext, ct));
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem("Gatekeeper", vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class ConstraintTemplateNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext, private readonly template: ConstraintTemplateInfo) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const constraints = await listConstraints(this.kubectl, this.template.name);
        if (failed(constraints)) {
            return [new ErrorNode(constraints.error[0])];
        }
        return constraints.result.map((c) => new ConstraintNode(this.extensionContext, c));
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.template.name, vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class ConstraintNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly extensionContext: vscode.ExtensionContext, private readonly instance: ConstraintInfo) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.instance.name, vscode.TreeItemCollapsibleState.None);
        treeItem.iconPath = this.extensionContext.asAbsolutePath(constraintIcon(this.instance.status));
        treeItem.tooltip = constraintTooltip(this.instance.status);
        return treeItem;
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

function constraintIcon(status: ConstraintStatus | undefined): string {
    if (!status) {
        return 'images/constraint-status-unknown.svg';
    }
    if (status.violationCount > 0) {
        return 'images/constraint-violated.svg';
    }
    return 'images/constraint-ok.svg';
}

function constraintTooltip(status: ConstraintStatus | undefined): string | undefined {
    if (!status) {
        return 'Unknown status';
    }
    if (status.violationCount > 0) {
        return `${status.violationCount} violation(s) (checked at ${displayTimestamp(status.timestamp)})`;
    }
    return undefined;
}

function displayTimestamp(timestamp: Date): string {
    const hour = zeroPad(timestamp.getHours(), 2);
    const minute = zeroPad(timestamp.getMinutes(), 2);
    const second = zeroPad(timestamp.getSeconds(), 2);
    return [hour, minute, second].join(':');
}

export function zeroPad(n: number, length: number): string {
    // This isn't optimised because it doesn't have to be
    let s = n.toString();
    while (s.length < length) {
        s = '0' + s;
    }
    return s;
}
