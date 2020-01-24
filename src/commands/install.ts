import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable, longRunning } from '../utils/host';

const GATEKEEPER_MANIFEST_URL = "https://raw.githubusercontent.com/open-policy-agent/gatekeeper/master/deploy/gatekeeper.yaml";

export async function install() {
    // TODO: The Helm chart isn't in a known repo at the moment, and Helm doesn't
    // accept the "https://github.com/open-policy-agent/gatekeeper/tree/master/chart/gatekeeper-operator"
    // GitHub reference.  So we'll use kubectl to install it for now.

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await showUnavailable(clusterExplorer.reason);
        return;
    }

    const installCmd = `apply -f ${GATEKEEPER_MANIFEST_URL}`;

    const installResult = await longRunning('Installing Gatekeeper...', () =>
        kubectl.api.invokeCommand(installCmd)
    );

    if (installResult && installResult.code === 0) {
        clusterExplorer.api.refresh();
        await vscode.window.showInformationMessage('Gatekeeper installed');
        return;
    }

    const reason = installResult ? installResult.stderr : 'unable to run command';
    vscode.window.showErrorMessage(`Failed to install Open Policy Agent: ${reason}`);
}
