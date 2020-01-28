import * as vscode from 'vscode';

export async function deployTemplate(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    await vscode.window.showInformationMessage('makin templates');
}
