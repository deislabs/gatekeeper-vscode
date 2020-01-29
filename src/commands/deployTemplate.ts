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

    const templateName = path.basename(regoDoc.uri.fsPath, '.rego');  // TODO: or the package name?
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
    const kind = kindify(templateName);
    const identifier = identifierfy(templateName);
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
    return name.replace(/^a-zA-Z0-9/g, '').toLowerCase();
}
