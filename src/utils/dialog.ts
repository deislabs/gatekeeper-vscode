import * as vscode from 'vscode';

const END_DIALOG_FN_NAME = "endDialog";
export const END_DIALOG_FN = `${END_DIALOG_FN_NAME}()`;
export function END_MESSAGE_DIALOG_WITH(s: string) { return `${END_DIALOG_FN_NAME}("${s}")`; }

export function dialog(tabTitle: string, htmlBody: string, formId: string): Promise<{ [key: string]: string }> {
    return new Promise<any>((resolve, _reject) => {
        const postbackScript = `<script>
        function ${END_DIALOG_FN} {
            const vscode = acquireVsCodeApi();
            const s = {};
            for (const e of document.forms['${formId}'].elements) {
                s[e.name] = e.value;
            }
            vscode.postMessage(s);
        }
        </script>`;

        const html = postbackScript + htmlBody;
        const w = vscode.window.createWebviewPanel('gkvs-dialog', tabTitle, vscode.ViewColumn.Active, {
            retainContextWhenHidden: false,
            enableScripts: true,
        });
        w.webview.html = html;
        const cancelSubscription = w.onDidDispose(() => resolve(undefined));
        w.webview.onDidReceiveMessage((m) => {
            cancelSubscription.dispose();
            w.dispose();
            resolve(m);
        });
        w.reveal();
    });
}

export interface MultiButtonDialogResult {
    readonly selectedButton: string;
    readonly formData: { [key: string]: string };
}

export function multiButtonDialog(tabTitle: string, htmlBody: string, formId: string): Promise<MultiButtonDialogResult> {
    return new Promise<any>((resolve, _reject) => {
        const postbackScript = `<script>
        function ${END_DIALOG_FN_NAME}(btn) {
            const vscode = acquireVsCodeApi();
            const s = {};
            for (const e of document.forms['${formId}'].elements) {
                s[e.name] = e.value;
            }
            const r = {
                selectedButton: btn,
                formData: s
            };
            vscode.postMessage(r);
        }
        </script>`;

        const html = postbackScript + htmlBody;
        const w = vscode.window.createWebviewPanel('gkvs-dialog', tabTitle, vscode.ViewColumn.Active, {
            retainContextWhenHidden: false,
            enableScripts: true,
        });
        w.webview.html = html;
        const cancelSubscription = w.onDidDispose(() => resolve(undefined));
        w.webview.onDidReceiveMessage((m) => {
            cancelSubscription.dispose();
            w.dispose();
            resolve(m);
        });
        w.reveal();
    });
}
