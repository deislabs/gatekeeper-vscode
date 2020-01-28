import * as vscode from 'vscode';
import * as path from 'path';
import { Linter } from './linter';
import * as regex from '../utils/regex';

// The idea with this one is that if the .rego contains an expression of
// the form `input.parameters.<identifier>` then the schema should contain
// a property named <identifier>.
//
// For the time being we are going to postulate a relationship of the
// form foo.rego <-> foo.schema.json

class UndefinedParametersLinter implements Linter {
    async lint(document: vscode.TextDocument, text: string): Promise<vscode.Diagnostic[]> {
        const schema = await associatedSchema(document);
        const diagnostics = lint(document, text, schema);
        return Array.of(...diagnostics);
    }

    fixes(_document: vscode.TextDocument, _text: string, _diagnostics: vscode.Diagnostic[]): vscode.CodeAction[] {
        return [];
    }
}

const PARAMETER_REF_REGEX = /input\.parameters\.([a-z][a-z0-9_]*)/ig;

function* lint(document: vscode.TextDocument, text: string, schema: JSONSchema | null): IterableIterator<vscode.Diagnostic> {
    if (!schema || !schema.properties) {
        return;
    }

    const parameterReferences = Array.of(...regex.exec(text, PARAMETER_REF_REGEX));
    if (!parameterReferences) {
        return;
    }

    for (const reference of parameterReferences) {
        if (reference.groups.length < 2) {
            continue;
        }

        const parameterName = reference.groups[1];
        if (parameterName) {
            if (!schema.properties[parameterName]) {
                const referenceRange = textRange(document, reference.index, reference.groups[0].length);
                const diagnostic = new vscode.Diagnostic(referenceRange, `Schema file does not define property '${parameterName}'`, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = DIAGNOSTIC_NO_DEFINITION;
                yield diagnostic;
            }
        }
    }
}

async function associatedSchema(document: vscode.TextDocument): Promise<JSONSchema | null> {
    try {
        const regoPath = document.uri.fsPath;
        const schemaPath = changeExtension(regoPath, 'schema.json');
        const schemaDocument = await vscode.workspace.openTextDocument(schemaPath);
        const schemaText = schemaDocument.getText();
        const schema = JSON.parse(schemaText);
        return schema;
    } catch {
        // It throws if the schema document doesn't exist or isn't parseable - we can just abandon ship in these cases
        return null;
    }
}

interface JSONSchema {
    readonly type?: string;
    readonly properties?: { [name: string]: JSONSchema };
    readonly items?: JSONSchema;
}

function changeExtension(filePath: string, newExt: string): string {
    const ext = path.extname(filePath);
    const basePath = filePath.substr(0, filePath.length - ext.length);
    return `${basePath}.${newExt}`;
}

function textRange(document: vscode.TextDocument, index: number, length: number): vscode.Range {
    const start = document.positionAt(index);
    const end = document.positionAt(index + length);
    return new vscode.Range(start, end);
}

const DIAGNOSTIC_NO_DEFINITION = 'gatekeeper_no_definition';

export const UNDEFINED_PARAMETERS_LINTER = new UndefinedParametersLinter();
