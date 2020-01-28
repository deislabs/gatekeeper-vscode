import * as vscode from 'vscode';

import { Linter } from './linter';
import { UNDEFINED_PARAMETERS_LINTER } from './undefined-parameters';

export const linters: ReadonlyArray<Linter> = [
    UNDEFINED_PARAMETERS_LINTER,
];

export function initialise() {
    const diagnostics = vscode.languages.createDiagnosticCollection('Gatekeeper');
    const lintDocument = lintTo(diagnostics);

    vscode.workspace.onDidOpenTextDocument(lintDocument);
    vscode.workspace.onDidChangeTextDocument((e) => lintDocument(e.document));  // TODO: we could use the change hint
    vscode.workspace.onDidSaveTextDocument(lintDocument);
    vscode.workspace.onDidCloseTextDocument((d) => diagnostics.delete(d.uri));
    vscode.workspace.textDocuments.forEach(lintDocument);
}

function lintTo(reporter: vscode.DiagnosticCollection): (document: vscode.TextDocument) => Promise<void> {
    return (document) => lintDocumentTo(document, reporter);
}

async function lintDocumentTo(document: vscode.TextDocument, reporter: vscode.DiagnosticCollection): Promise<void> {
    // Is it a Rego document?
    if (!isLintable(document)) {
        return;
    }
    const linterPromises = linters.map((l) => l.lint(document, document.getText()));
    const linterResults = await Promise.all(linterPromises);
    const diagnostics = ([] as vscode.Diagnostic[]).concat(...linterResults);
    reporter.set(document.uri, diagnostics);
}

function isLintable(document: vscode.TextDocument): boolean {
    return document.languageId === 'rego';
}
