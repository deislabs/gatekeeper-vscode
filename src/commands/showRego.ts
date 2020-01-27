import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { regoUri } from '../ui/rego-only.vfs';

export async function showRego(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }

    const node = ResourceBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'gatekeeper-constraint-template') {
        const templateName = node.template.name;
        await showRegoDocument(templateName);
    }
}

async function showRegoDocument(templateName: string) {
    const uri = regoUri(templateName);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
}
