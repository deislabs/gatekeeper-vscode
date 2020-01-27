import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';

export async function showResource(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(kubectl.reason)}`);
        return;
    }

    const node = ResourceBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'gatekeeper-constraint-template') {
        const templateName = node.template.name;
        await tryShowTemplate(kubectl.api, templateName);
    } else if (node && node.nodeType === 'gatekeeper-constraint') {
        const templateName = node.template.name;
        const constraintName = node.constraint.name;
        await tryShowConstraint(kubectl.api, templateName, constraintName);
    }
}

async function tryShowTemplate(kubectl: k8s.KubectlV1, templateName: string) {
    await vscode.window.showInformationMessage(`this is template ${templateName}`);
}

async function tryShowConstraint(kubectl: k8s.KubectlV1, templateName: string, constraintName: string) {
    await vscode.window.showInformationMessage(`this is constraint ${templateName}/${constraintName}`);
}
