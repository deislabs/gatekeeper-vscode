import * as vscode from 'vscode';
import { associatedSchemaDocument } from '../authoring/associations';

export async function parametersSchema(textEditor: vscode.TextEditor, _edit: vscode.TextEditorEdit) {
    const regoDoc = textEditor.document;
    const associatedSchemaDoc = await associatedSchemaDocument(regoDoc);

    if (associatedSchemaDoc) {
        await vscode.window.showTextDocument(associatedSchemaDoc);
        return;
    }

    vscode.window.showWarningMessage("You haven't done creating new ones yet Ivan!");
}
