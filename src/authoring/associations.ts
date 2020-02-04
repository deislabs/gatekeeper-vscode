import * as vscode from 'vscode';
import * as path from 'path';

export async function associatedSchema(document: vscode.TextDocument): Promise<JSONSchema | null> {
    try {
        const schemaDocument = await associatedSchemaDocument(document);
        if (!schemaDocument) {
            return null;
        }
        const schemaText = schemaDocument.getText();
        const schema = JSON.parse(schemaText);
        return schema;
    } catch {
        // It throws if the schema document doesn't exist or isn't parseable - we can just abandon ship in these cases
        return null;
    }
}

export async function associatedSchemaDocument(document: vscode.TextDocument): Promise<vscode.TextDocument | null> {
    try {
        const schemaPath = associatedSchemaPath(document);
        const schemaDocument = await vscode.workspace.openTextDocument(schemaPath);
        return schemaDocument;
    } catch {
        // It throws if the schema document doesn't exist - we can just abandon ship in this case
        return null;
    }
}

export function associatedSchemaPath(document: vscode.TextDocument): string {
    const regoPath = document.uri.fsPath;
    const schemaPath = changeExtension(regoPath, 'schema.json');
    return schemaPath;
}

export interface JSONSchema {
    readonly $schema?: string;
    readonly type?: string;
    readonly properties?: { [name: string]: JSONSchema };
    readonly items?: JSONSchema;
}

function changeExtension(filePath: string, newExt: string): string {
    const ext = path.extname(filePath);
    const basePath = filePath.substr(0, filePath.length - ext.length);
    return `${basePath}.${newExt}`;
}
