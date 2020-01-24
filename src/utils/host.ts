import * as vscode from 'vscode';

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export async function showUnavailable(reason: "version-unknown" | "version-removed" | "extension-not-available") {
    await vscode.window.showErrorMessage(`Cannot run command: ${unavailableMessage(reason)}`);
}

export function unavailableMessage(reason: "version-unknown" | "version-removed" | "extension-not-available"): string {
    switch (reason) {
        case "extension-not-available": return "please check the 'Kubernetes' extension is installed";
        case "version-removed": return "please check for updates to the 'Open Policy Agent for Kubernetes' extension";
        case "version-unknown": return "please check for updates to the 'Kubernetes' extension";
    }
}
