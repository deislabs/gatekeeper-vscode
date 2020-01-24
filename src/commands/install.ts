import * as vscode from 'vscode';

export async function install() {
    await vscode.window.showInformationMessage('totally installing Gatekeeper now');
}
