import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { associatedSchema, JSONSchema } from '../authoring/associations';

export async function deployTemplate(textEditor: vscode.TextEditor, _edit: vscode.TextEditorEdit) {
    // what we need to do:
    // - combine the .rego, magic comments and schema into one big honkin YAML
    // - display it to the user
    // - get their okay
    // - BAG IT UP AND SHIP IT OUT

    const regoDoc = textEditor.document;
    const associatedSchemaObj = await associatedSchema(regoDoc);

    if (!associatedSchemaObj) {
        await vscode.window.showErrorMessage('No associated schema - extension does not yet support this case');
        return;
    }

    const templateName = path.basename(regoDoc.uri.fsPath, '.rego');
    const rego = regoDoc.getText();

    const template = constraintTemplate(templateName, rego, associatedSchemaObj);

    const templateYAML = yaml.safeDump(template);

    console.log(templateYAML);
}

function constraintTemplate(templateName: string, rego: string, schema: JSONSchema): any {
    return {
        apiVersion: "templates.gatekeeper.sh/v1beta1",
        kind: "ConstraintTemplate",
        metadata: {
            name: templateName
        },
        spec: {
            crd: {
                spec: constraintTemplateCRDSpec(templateName, schema)
            },
            targets: [
                constraintTemplateTarget(rego)
            ]
        }
    };
}

function constraintTemplateCRDSpec(templateName: string, schema: JSONSchema): any {
    return {
        names: {
            kind: templateName + 'Kind',
            listKind: templateName + 'KindList',
            plural: templateName + 'Plural',
            singular: templateName
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
