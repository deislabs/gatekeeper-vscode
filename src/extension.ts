import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { install } from './commands/install';
import { unavailableMessage } from './utils/host';
import { ResourceBrowser } from './ui/resource-browser';
import { showViolations } from './commands/showViolations';
import { showResource } from './commands/showResource';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('gatekeeper.install', install),
        vscode.commands.registerCommand('gatekeeper.show', showResource),
        vscode.commands.registerCommand('gatekeeper.violations', showViolations),
    ];

    context.subscriptions.push(...disposables);

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;
    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Can't show Gatekeeper resources: ${unavailableMessage(clusterExplorer.reason)}`);
    } else if (!kubectl.available) {
        vscode.window.showWarningMessage(`Can't show Gatekeeper resources: ${unavailableMessage(kubectl.reason)}`);
    } else {
        clusterExplorer.api.registerNodeContributor(ResourceBrowser.create(kubectl.api, context));
    }
}

export function deactivate() {
}
