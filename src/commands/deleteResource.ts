import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning, warnConfirm } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { listConstraints } from '../gatekeeper';
import { failed } from '../utils/errorable';

export async function deleteResource(target: any) {
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
        await tryDeleteTemplate(kubectl.api, clusterExplorer.api, templateName);
    } else if (node && node.nodeType === 'gatekeeper-constraint') {
        const templateName = node.template.name;
        const constraintName = node.constraint.name;
        await tryDeleteConstraint(kubectl.api, clusterExplorer.api, templateName, constraintName);
    }
}

async function tryDeleteTemplate(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, templateName: string) {
    const confirmed = await confirmTemplateDeletion(kubectl, templateName);
    if (!confirmed) {
        return;
    }

    const resourceId = `constrainttemplates/${templateName}`;
    await tryDeleteResource(kubectl, clusterExplorer, resourceId);
}

async function tryDeleteConstraint(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, templateName: string, constraintName: string) {
    const confirmed = await warnConfirm(`Do you want to delete the constraint '${constraintName}'?`, `Delete`, `Cancel`);
    if (!confirmed) {
        return;
    }

    const resourceId = `${templateName}/${constraintName}`;
    await tryDeleteResource(kubectl, clusterExplorer, resourceId);
}

async function tryDeleteResource(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, resourceId: string) {
    const deleteResult = await longRunning(`Deleting ${resourceId}...`, () =>
        kubectl.invokeCommand(`delete ${resourceId}`)
    );
    if (!deleteResult || deleteResult.code !== 0) {
        const message = deleteResult ? deleteResult.stderr : "Unable to call kubectl";
        await vscode.window.showErrorMessage(`Failed to delete resource '${resourceId}': ${message}`);
        return;
    }

    clusterExplorer.refresh();
    await vscode.window.showInformationMessage(deleteResult.stdout);
}

async function confirmTemplateDeletion(kubectl: k8s.KubectlV1, templateName: string): Promise<boolean> {
    const constraints = await longRunning(`Checking for constraints of type ${templateName}...`, () =>
        listConstraints(kubectl, templateName)
    );

    if (failed(constraints)) {
        return await warnConfirm(`Can't check if there are constraints depending on template ${templateName}. If there are, they will be deleted too.`, "I'm sure it's safe: delete anyway", "Don't delete");
    }
    if (constraints.result.length > 0) {
        return await warnConfirm(`This will also delete all ${constraints.result.length} constraints depending on template '${templateName}'.`, "I don't need them: delete anyway", "Don't delete");
    }
    return await warnConfirm(`Do you want to delete the template '${templateName}'?`, "Delete", "Cancel");
}
