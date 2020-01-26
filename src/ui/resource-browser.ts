import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { GATEKEEPER_RESOURCE_KINDS } from '../gatekeeper';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        const resourceFolders = GATEKEEPER_RESOURCE_KINDS.map((k) => clusterExplorer.nodeSources.resourceFolder(k.displayName, k.pluralDisplayName, k.manifestKind, k.abbreviation));
        return clusterExplorer.nodeSources.groupingFolder("Gatekeeper", undefined, ...resourceFolders).at(undefined);
    }
}
