import * as vscode from 'vscode';

import { associatedSchemaDocument, associatedSchemaPath } from '../authoring/associations';
import { fs } from '../utils/fs';

export async function parametersSchema(textEditor: vscode.TextEditor, _edit: vscode.TextEditorEdit) {
    const regoDoc = textEditor.document;
    const associatedSchemaDoc = await associatedSchemaDocument(regoDoc);

    if (associatedSchemaDoc) {
        await vscode.window.showTextDocument(associatedSchemaDoc);
        return;
    }

    await openNewSchema(regoDoc);
}

async function openNewSchema(regoDoc: vscode.TextDocument): Promise<void> {
    const schemaPath = associatedSchemaPath(regoDoc);
    await fs.writeFile(schemaPath, schemaJSON());
    const schemaDoc = await vscode.workspace.openTextDocument(schemaPath);
    await vscode.window.showTextDocument(schemaDoc);
}

function schemaJSON(): string {
    const schema = {
        $schema: 'http://json-schema.org/draft-07/schema',
        properties: { }
    };

    return JSON.stringify(schema, undefined, 2);
}
