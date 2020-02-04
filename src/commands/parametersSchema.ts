import * as vscode from 'vscode';

import { associatedSchemaDocument, associatedSchemaPath, JSONSchema } from '../authoring/associations';
import { fs } from '../utils/fs';
import * as regex from '../utils/regex';

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
    await fs.writeFile(schemaPath, schemaJSON(regoDoc.getText()));
    const schemaDoc = await vscode.workspace.openTextDocument(schemaPath);
    await vscode.window.showTextDocument(schemaDoc);
}

function schemaJSON(rego: string): string {
    const schema = {
        $schema: 'http://json-schema.org/draft-07/schema',
        properties: schemaProperties(rego)
    };

    return JSON.stringify(schema, undefined, 2);
}

function schemaProperties(rego: string): { [key: string]: JSONSchema } {
    const parameters = Array.of(...extractInputParameters(rego));
    const properties: { [key: string]: any } = { };
    for (const parameter of parameters) {
        properties[parameter.name] = parameterSchema(parameter);
    }
    return properties;
}

function parameterSchema(parameter: { isArray: boolean }): JSONSchema {
    if (parameter.isArray) {
        return {
            type: 'array',
            items: {
                type: 'string'
            }
        };
    } else {
        return {
            type: 'string'
        };
    }
}

const PARAMETER_REF_REGEX = /input\.parameters\.([a-z][a-z0-9_]*)(\[)?/ig;

function* extractInputParameters(rego: string) {
    const parameterReferences = Array.of(...regex.exec(rego, PARAMETER_REF_REGEX));
    if (!parameterReferences) {
        return;
    }

    for (const reference of parameterReferences) {
        if (reference.groups.length < 2) {
            continue;
        }

        const parameterName = reference.groups[1];
        const isArray = !!(reference.groups[2]);

        yield { name: parameterName, isArray };
    }
}
