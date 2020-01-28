import { TextDocument, Diagnostic, CodeAction } from "vscode";

export interface Linter {
    lint(document: TextDocument, text: string): Promise<Diagnostic[]>;
    fixes(document: TextDocument, text: string, diagnostics: ReadonlyArray<Diagnostic>): Promise<CodeAction[]>;
}
