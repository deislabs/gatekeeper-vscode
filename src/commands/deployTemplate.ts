import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { associatedSchema, JSONSchema } from '../authoring/associations';
import { withTempFile } from '../utils/tempfile';
import { longRunning, unavailableMessage } from '../utils/host';
import { multiButtonDialog, END_MESSAGE_DIALOG_WITH } from '../utils/dialog';

export async function deployTemplate(textEditor: vscode.TextEditor, _edit: vscode.TextEditorEdit) {
    // what we need to do:
    // - combine the .rego, magic comments and schema into one big honkin YAML
    // - display it to the user
    // - get their okay
    // - BAG IT UP AND SHIP IT OUT

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

    const regoDoc = textEditor.document;
    const associatedSchemaObj = await associatedSchema(regoDoc);

    if (!associatedSchemaObj) {
        await vscode.window.showErrorMessage('No associated schema - extension does not yet support this case');
        return;
    }

    const rawName = path.basename(regoDoc.uri.fsPath, '.rego');  // TODO: or the package name?
    const templateName = identifierfy(rawName);
    const rego = regoDoc.getText();

    const template = constraintTemplate(templateName, rawName, rego, associatedSchemaObj);

    const templateYAML = yaml.safeDump(template);

    const deployAction = await confirmDeploy(templateYAML, templateName);

    if (deployAction === DeployAction.Cancel) {
        return;
    }

    const deployResult = await withTempFile(templateYAML, 'yaml', (filename) =>
        longRunning(`Deploying template ${templateName} to cluster...`, () =>
            kubectl.api.invokeCommand(`apply -f ${filename}`)
        )
    );

    if (!deployResult || deployResult.code !== 0) {
        const message = deployResult ? deployResult.stderr : 'Unable to run kubectl';
        await vscode.window.showErrorMessage(`Failed to deploy template: ${message}`);
        return;
    }

    clusterExplorer.api.refresh();
    await vscode.window.showInformationMessage(`Deployed template ${templateName} to cluster`);
}

enum DeployAction {
    Cancel,
    Deploy,
}

const DEPLOY_BUTTON_ID = "btn_deploy";
const CANCEL_BUTTON_ID = "btn_cancel";

async function confirmDeploy(resourceYAML: string, resourceName: string): Promise<DeployAction> {
    const markdown = [  // Markdown is sensitive to leading whitespace so be cautious if you try to prettify this
`### This will deploy the following YAML as constraint template ${resourceName}`,
`${markdownCode(resourceYAML)}`
    ].join('\n');
    const mdhtml = await vscode.commands.executeCommand<string>('markdown.api.render', markdown);
    const html = `
        <form id='form'>
            <div>
            ${mdhtml}
            </div>
            <p>
                <button onclick='${END_MESSAGE_DIALOG_WITH(DEPLOY_BUTTON_ID)};'>Deploy to Cluster</button>
                <button onclick='${END_MESSAGE_DIALOG_WITH(CANCEL_BUTTON_ID)};'>Cancel</button>
            </p>
        </form>
    `;
    const dialogResult = await multiButtonDialog(`Deploy ${resourceName}`, html, 'form');
    switch (dialogResult.selectedButton) {
        case DEPLOY_BUTTON_ID: return DeployAction.Deploy;
        default: return DeployAction.Cancel;
    }
}

function constraintTemplate(templateName: string, rawName: string, rego: string, schema: JSONSchema): any {
    return {
        apiVersion: "templates.gatekeeper.sh/v1beta1",
        kind: "ConstraintTemplate",
        metadata: {
            name: templateName
        },
        spec: {
            crd: {
                spec: constraintTemplateCRDSpec(rawName, schema)
            },
            targets: [
                constraintTemplateTarget(rego)
            ]
        }
    };
}

function constraintTemplateCRDSpec(rawName: string, schema: JSONSchema): any {
    const kind = kindify(rawName);
    const identifier = identifierfy(rawName);
    return {
        names: {
            kind: kind,
            listKind: kind + 'List',
            plural: identifier,
            singular: identifier
        },
        validation: {
            openAPIV3Schema: schema
        }
    };
}

function constraintTemplateTarget(rego: string): any {
    return {
        target: 'admission.k8s.gatekeeper.sh',
        rego: rego
    };
}

function kindify(name: string): string {
    if (!name || name.length === 0) {
        return '';
    }

    const bits = name.split(/[^a-zA-Z0-9]/);
    const titleCasedBits = bits.map((s) => titleCase(s));
    const kindified = titleCasedBits.join('');
    return kindified;
}

function titleCase(s: string): string {
    if (s === '') {
        return s;
    }
    return s[0].toUpperCase() + s.slice(1);
}

function identifierfy(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function markdownCode(code: string): string {
    const delimiter = '```';
    return `${delimiter}\n${code}\n${delimiter}`;
}
