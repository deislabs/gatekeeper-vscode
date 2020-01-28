import * as vscode from 'vscode';

import { linters } from './diagnostics';
import { flatten } from '../utils/array';

export namespace GatekeeperCodeActionProvider {
    export function create(): vscode.CodeActionProvider {
        return new CodeActionProvider();
    }
}

class CodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, _token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        return provideCodeActions(document, context);
    }
}

async function provideCodeActions(document: vscode.TextDocument, context: vscode.CodeActionContext): Promise<(vscode.Command | vscode.CodeAction)[]> {
    // TODO: it would be really good if we could cache some of this info inside the Diagnostic, because
    // it seems like we are repeating calculations...
    if (!isLintable(document)) {
        return [];
    }

    const actionsPromises = linters.map((l) => l.fixes(document, document.getText(), context.diagnostics));
    const actions = await Promise.all(actionsPromises);
    return flatten(...actions);
}

function isLintable(document: vscode.TextDocument): boolean {
    return document.languageId === 'rego';
}
