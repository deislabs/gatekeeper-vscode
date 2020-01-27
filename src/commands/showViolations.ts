import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, longRunning } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { getConstraint, ConstraintDetail, ConstraintStatusDetail, ConstraintViolation } from '../gatekeeper';
import { failed } from '../utils/errorable';

const MD_HORIZONTAL_RULE = `\n---\n`;

export async function showViolations(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(kubectl.reason)}`);
        return;
    }

    const node = ResourceBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'gatekeeper-constraint') {
        const templateName = node.template.name;
        const constraintName = node.constraint.name;
        await tryShowViolations(kubectl.api, templateName, constraintName);
    }
}

async function tryShowViolations(kubectl: k8s.KubectlV1, templateName: string, constraintName: string): Promise<void> {
    const constraint = await longRunning(`Getting constraint ${templateName}/${constraintName}`, () =>
        getConstraint(kubectl, templateName, constraintName)
    );
    if (failed(constraint)) {
        await vscode.window.showErrorMessage(`Can't display violations: ${constraint.error[0]}`);
        return;
    }
    const markdown = renderMarkdown(constraint.result);
    const mdhtml = await vscode.commands.executeCommand<string>('markdown.api.render', markdown);
    if (!mdhtml) {
        await vscode.window.showErrorMessage("Can't show policy: internal error");
        return;
    }

    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"><head><body>${mdhtml}</body></html>`;

    const webview = vscode.window.createWebviewPanel('gk-violations-view', constraintName, vscode.ViewColumn.Active, { enableFindWidget: true });
    webview.webview.html = html;
    webview.reveal();
}

function renderMarkdown(constraint: ConstraintDetail): string {
    return [
        `## ${constraint.name}`,
        `Instance of template ${constraint.templateName}`,
        MD_HORIZONTAL_RULE,
        ...renderStatus(constraint.status)
    ].join('\n');
}

function renderStatus(status: ConstraintStatusDetail | undefined): string[] {
    if (!status) {
        return [
            'Status information not available'
        ];
    }

    if (status.violations.length === 0) {
        return [
            `No constraint violations (at ${displayTimestamp(status.timestamp)})`,
        ];
    }

    return [
        `${status.violations.length} constraint violation(s) at ${displayTimestamp(status.timestamp)}`,
        '| Resource Kind | Resource Name | Violation |',
        '|---|---|---|',
        ...status.violations.map((v) => renderViolation(v)),
    ];
}

function renderViolation(violation: ConstraintViolation): string {
    return `| ${violation.resource.kind} | ${violation.resource.name} | ${violation.message} |`;
}

function displayTimestamp(timestamp: Date): string {
    const hour = zeroPad(timestamp.getHours(), 2);
    const minute = zeroPad(timestamp.getMinutes(), 2);
    const second = zeroPad(timestamp.getSeconds(), 2);
    return [hour, minute, second].join(':');
}

export function zeroPad(n: number, length: number): string {
    // This isn't optimised because it doesn't have to be
    let s = n.toString();
    while (s.length < length) {
        s = '0' + s;
    }
    return s;
}
