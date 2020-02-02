import * as vscode from 'vscode';
import levenshtein = require('js-levenshtein');

import * as path from 'path';
import { Linter } from './linter';
import * as regex from '../utils/regex';
import { flatten } from '../utils/array';

// The idea with this one is that if the .rego contains an expression of
// the form `input.parameters.<identifier>` then the schema should contain
// a property named <identifier>.
//
// For the time being we are going to postulate a relationship of the
// form foo.rego <-> foo.schema.json

const MAX_TOLERANCE = 10;
const MAX_OFFERED_FIXES = 5;

class UndefinedParametersLinter implements Linter {
    async lint(document: vscode.TextDocument, text: string): Promise<vscode.Diagnostic[]> {
        const schema = await associatedSchema(document);
        const diagnostics = lint(document, text, schema);
        return Array.of(...diagnostics);
    }

    async fixes(document: vscode.TextDocument, _text: string, diagnostics: vscode.Diagnostic[]): Promise<vscode.CodeAction[]> {
        const schema = await associatedSchema(document);
        const fixables = diagnostics.filter((d) => d.code === DIAGNOSTIC_NO_DEFINITION);
        const actionsPromises = fixables.map((f) => fixes(f, document, schema));
        const actions = await Promise.all(actionsPromises);
        return flatten(...actions);
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
                const offset = 'input.parameters.'.length;
                const referenceRange = textRange(document, reference.index + offset, parameterName.length);
                const diagnostic = new vscode.Diagnostic(referenceRange, `Schema file does not define property '${parameterName}'`, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = DIAGNOSTIC_NO_DEFINITION;
                yield diagnostic;
            }
        }
    }
}

async function fixes(diagnostic: vscode.Diagnostic, document: vscode.TextDocument, schema: JSONSchema | null): Promise<ReadonlyArray<vscode.CodeAction>> {
    return await proposeParameters(diagnostic, document, schema);
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

async function proposeParameters(diagnostic: vscode.Diagnostic, document: vscode.TextDocument, schema: JSONSchema | null): Promise<ReadonlyArray<vscode.CodeAction>> {
    if (!schema || !schema.properties) {
        return [];
    }

    const faultyText = document.getText(diagnostic.range);

    const candidates = Object.keys(schema.properties)
                           .map((v) => ({ name: v, score: levenshtein(v, faultyText) }))
                           .sort((v1, v2) => v1.score - v2.score);

    return candidates.filter((c) => c.score <= MAX_TOLERANCE)
                     .slice(0, MAX_OFFERED_FIXES)
                     .map((c) => substituteParameterAction(document, diagnostic.range, `${c.name}`));
}

function substituteParameterAction(document: vscode.TextDocument, range: vscode.Range, proposed: string): vscode.CodeAction {
    const action = new vscode.CodeAction(`Change to ${proposed}`, vscode.CodeActionKind.QuickFix);
    action.edit = substituteParameterEdit(document, range, proposed);
    return action;
}

function substituteParameterEdit(document: vscode.TextDocument, range: vscode.Range, proposed: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, proposed);
    return edit;
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
