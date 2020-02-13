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

export async function showWorkspaceFolderPick(): Promise<vscode.WorkspaceFolder | undefined> {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return undefined;
    } else if (vscode.workspace.workspaceFolders.length === 1) {
        return vscode.workspace.workspaceFolders[0];
    }
    return await vscode.window.showWorkspaceFolderPick();
}

export async function selectRootFolder(): Promise<string | undefined> {
    const folder = await showWorkspaceFolderPick();
    if (!folder) {
        return undefined;
    }
    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");  // TODO: make it not
        return undefined;
    }
    return folder.uri.fsPath;
}

export async function warnConfirm(message: string, acceptText: string, cancelText: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(message, acceptText, cancelText);
    if (!choice || choice === cancelText) {
        return false;
    }
    return true;
}
