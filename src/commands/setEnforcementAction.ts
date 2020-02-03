import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';

const ENFORCEMENT_ACTIONS = [
    { baseLabel: 'Deny', action: 'deny'},
    { baseLabel: 'Dry Run', action: 'dryrun'},
] as const;

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
    const sr = await longRunning(`Getting constraint ${templateName}/${constraintName}`, () =>
        kubectl.invokeCommand(`get ${templateName}/${constraintName} -o json`)
    );
    if (!sr || sr.code !== 0) {
        const message = sr ? sr.stderr : 'Unable to run kubectl';
        await vscode.window.showErrorMessage(`Can't get constraint info: ${message}`);
        return;
    }

    const constraintJSON = sr.stdout;
    const constraint = JSON.parse(constraintJSON);
    const currentAction: string = ((constraint.spec || {}).enforcementAction) || 'deny';

    const availableActions = ENFORCEMENT_ACTIONS.map((a) => {
        const suffix = (a.action === currentAction) ? ' (current)' : '';
        return { label: a.baseLabel + suffix, ...a };
    });
    const selection = await vscode.window.showQuickPick(availableActions);
    if (!selection || selection.action === currentAction) {
        return;
    }

    const patch = {
        spec: {
            enforcementAction: selection.action
        }
    };
    const patchJSON = JSON.stringify(patch);
    const escapedPatchJSON = patchJSON.replace(/\"/g, "\\\"");

    const applyResult = await longRunning(`Updating constraint ${templateName}/${constraintName} with new action`, () =>
        kubectl.invokeCommand(`patch ${templateName}/${constraintName} --type=merge --patch ${escapedPatchJSON}`)
    );

    if (!applyResult || applyResult.code !== 0) {
        const message = applyResult ? applyResult.stderr : 'Unable to run kubectl';
        await vscode.window.showErrorMessage(`Error updating constraint ${templateName}/${constraintName}: ${message}`);
        return;
    }

    await vscode.window.showInformationMessage(`Updated constraint ${templateName}/${constraintName} with new action`);
}
