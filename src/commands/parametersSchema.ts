import * as vscode from 'vscode';

export async function parametersSchema(textEditor: vscode.TextEditor, _edit: vscode.TextEditorEdit) {
    await vscode.window.showInformationMessage('parameters schema');
}
