import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { unavailableMessage, longRunning, showWorkspaceFolderPick } from '../utils/host';
import { ResourceBrowser } from '../ui/resource-browser';
import { failed, Errorable } from '../utils/errorable';
import { getConstraintTemplate, ConstraintTemplateDetail } from '../gatekeeper';
import { JSONSchema } from '../authoring/associations';
import { Cancellable } from '../utils/cancellable';
import { fs } from '../utils/fs';

export async function createConstraint(target: any) {
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
    if (node && node.nodeType === 'gatekeeper-constraint-template') {
        const templateName = node.template.name;
        await tryCreateConstraint(kubectl.api, templateName);
    }
}

async function tryCreateConstraint(kubectl: k8s.KubectlV1, templateName: string): Promise<void> {
    const template = await longRunning(`Getting constraint template ${templateName}`, () =>
        getConstraintTemplate(kubectl, templateName)
    );
    if (failed(template)) {
        await vscode.window.showErrorMessage(`Can't get constraint template: ${template.error[0]}`);
        return;
    }

    // TODO: this would be better after the template validity checks
    const name = await promptName();
    if (name.cancelled) {
        return;
    }

    const constraint = await constraintResource(template.result, name.value);

    if (failed(constraint)) {
        await vscode.window.showErrorMessage(`Can't create constraint resource: ${constraint.error[0]}`);
        return;
    }

    const constraintYAMLSnippet = yaml.safeDump(constraint.result);

    const document = await createYAMLDocument(name.value);
    if (document.cancelled) {
        return;
    }

    const editor = await vscode.window.showTextDocument(document.value);
    await editor.insertSnippet(new vscode.SnippetString(constraintYAMLSnippet));
}

async function constraintResource(template: ConstraintTemplateDetail, constraintName: string): Promise<Errorable<object>> {

    if (!template.spec || !template.spec.crd || !template.spec.crd.spec) {
        return { succeeded: false, error: ["Template does not contain a custom resource spec"] };
    }
    if (!template.spec.crd.spec.names.kind) {
        return { succeeded: false, error: ["Template does not specify a kind for the constraint custom resource type"] };
    }

    const crdSpec = template.spec.crd.spec;

    const constraint = {
        apiVersion: "constraints.gatekeeper.sh/v1beta1",
        kind: crdSpec.names.kind,
        metadata: {
            name: placeholder(1, { defaultValue: constraintName })
        },
        spec: {
            enforcementAction: placeholder(2, { choices: ['dryrun', 'deny'] }),
            match: {
                kinds: []
            },
            parameters: createParameters(crdSpec.validation?.openAPIV3Schema, 3)
        }
    };

    return { succeeded: true, result: constraint };
}

function createParameters(schema: JSONSchema | undefined, initialPlaceholderIndex: number): object {
    if (!schema) {
        return {};
    }
    if (!schema.properties) {
        return {};
    }

    let placeholderIndex = initialPlaceholderIndex;
    const parameters: { [key: string]: any } = {};

    for (const [parameterName, parameterSchema] of Object.entries(schema.properties)) {
        const snippetPlaceholder = placeholder(placeholderIndex++);
        const value = parameterSchema.type === 'array' ? [ snippetPlaceholder ] : snippetPlaceholder;
        parameters[parameterName] = value;
    }

    return parameters;
}

async function promptName(): Promise<Cancellable<string>> {
    const name = await vscode.window.showInputBox({ prompt: 'Choose a name for the constraint', validateInput: validateName });
    if (name) {
        return { cancelled: false, value: name };
    }
    return { cancelled: true };
}

function validateName(name: string): string | null {
    if (/^[a-z][-a-z0-9.]*$/.test(name)) {
        return null;
    }
    return 'Name must begin with a letter and contain only letters, numbers, hyphens and periods';
}

function placeholder(index: number, content?: { defaultValue: string } | { choices: string[] }): string {
    if (!content) {
        return `${DOLLAR_OPEN_BRACE}${index}}`;
    }
    const defaultValue = (content as { defaultValue: string }).defaultValue;
    const choices = (content as { choices: string[] }).choices;
    if (defaultValue) {
        return `${DOLLAR_OPEN_BRACE}${index}:${defaultValue}}`;
    }
    if (choices) {
        return `${DOLLAR_OPEN_BRACE}${index}|${choices.join(',')}|}`;
    }
    return `${DOLLAR_OPEN_BRACE}${index}}`;
}

async function createYAMLDocument(name: string): Promise<Cancellable<vscode.TextDocument>> {
    const targetFolder = await showWorkspaceFolderPick();
    if (!targetFolder) {
        return { cancelled: true };
    }

    const filePath = path.join(targetFolder.uri.fsPath, `${name}.yaml`);

    try {
        await fs.writeFile(filePath, '', 'utf8');  // TODO: handle overwrite situation
        const document = await vscode.workspace.openTextDocument(filePath);
        return { cancelled: false, value: document };
    } catch (e) {
        const document = await vscode.workspace.openTextDocument({ language: 'yaml', content: '' });
        return { cancelled: false, value: document };
    }
}

const DOLLAR_OPEN_BRACE = '${';
