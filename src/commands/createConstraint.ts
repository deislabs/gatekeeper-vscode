import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { failed } from '../utils/errorable';

export async function createConstraint(target: any) {
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
        await tryCreateConstraint(kubectl.api, templateName);
    }
}

async function tryCreateConstraint(kubectl: k8s.KubectlV1, templateName: string): Promise<void> {
    // const template = await longRunning(`Getting constraint template crd/${templateName}`, () =>
    //     getConstraintT(kubectl, templateName)
    // );
    // if (failed(template)) {
    //     await vscode.window.showErrorMessage(`Can't get constraint template: ${template.error[0]}`);
    //     return;
    // }

    vscode.window.showInformationMessage('pretend to create constraint YAML');
}
