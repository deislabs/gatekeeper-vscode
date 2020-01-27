import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';

export async function showResource(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }

    const node = ResourceBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'gatekeeper-constraint-template') {
        const templateName = node.template.name;
        await tryShowTemplate(templateName);
    } else if (node && node.nodeType === 'gatekeeper-constraint') {
        const templateName = node.template.name;
        const constraintName = node.constraint.name;
        await tryShowConstraint(templateName, constraintName);
    }
}

async function tryShowTemplate(templateName: string) {
    const resourceId = `constrainttemplates/${templateName}`;
    await showResourceDocument(resourceId);
}

async function tryShowConstraint(templateName: string, constraintName: string) {
    const resourceId = `${templateName}/${constraintName}`;
    await showResourceDocument(resourceId);
}

async function showResourceDocument(resourceId: string) {
    const uri = kubefsUri(null, resourceId, 'yaml');
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
}

// TODO: copied from vscode-kubernetes-tools - needs to be added to API
const K8S_RESOURCE_SCHEME = "k8smsx";
const KUBECTL_RESOURCE_AUTHORITY = "loadkubernetescore";
function kubefsUri(namespace: string | null | undefined /* TODO: rationalise null and undefined */, value: string, outputFormat: string): vscode.Uri {
    const docname = `${value.replace('/', '-')}.${outputFormat}`;
    const nonce = new Date().getTime();
    const nsquery = namespace ? `ns=${namespace}&` : '';
    const uri = `${K8S_RESOURCE_SCHEME}://${KUBECTL_RESOURCE_AUTHORITY}/${docname}?${nsquery}value=${value}&_=${nonce}`;
    return vscode.Uri.parse(uri);
}
