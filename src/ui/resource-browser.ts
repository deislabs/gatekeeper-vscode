import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        return clusterExplorer.nodeSources.groupingFolder("Gatekeeper", undefined).at(undefined);
    }
}
