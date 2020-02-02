import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { getConstraint, ConstraintDetail, ConstraintStatusDetail, ConstraintViolation } from '../gatekeeper';
import { failed } from '../utils/errorable';

export async function setEnforcementAction(target: any) {
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
    if (node && node.nodeType === 'gatekeeper-constraint') {
        const templateName = node.template.name;
        const constraintName = node.constraint.name;
        await trySetEnforcementAction(kubectl.api, templateName, constraintName);
    }
}

async function trySetEnforcementAction(kubectl: k8s.KubectlV1, templateName: string, constraintName: string): Promise<void> {
    const constraint = await longRunning(`Getting constraint ${templateName}/${constraintName}`, () =>
        getConstraint(kubectl, templateName, constraintName)
    );
    if (failed(constraint)) {
        await vscode.window.showErrorMessage(`Can't get constraint info: ${constraint.error[0]}`);
        return;
    }

    vscode.window.showInformationMessage('pretending to prompt for the enforcement action');
}
