import * as k8s from 'vscode-kubernetes-tools-api';
import { Errorable } from "./utils/errorable";

// * A ConstraintTemplate contains:
//   + spec
//     + crd
//       (normal CRD stuff like names and validation)
//     + targets
//       + array of { target, rego }
//
// This creates a CRD with the following definition:
// apiVersion: constraints.gatekeeper.sh/v1beta1  // TODO: confirm
// kind: {{ .spec.crd.spec.names.kind }}
// spec:
//   match:
//     kinds:
//       - array of { apiGroups, kinds, ?more? }
//       ?anything else?
//     parameters:
//       (as defined by the schema in .spec.crd.spec.validation.openAPIV3Schema)
//
// Then a *constraint* (that uses the template) is an *instance* of the CRD
// (under the apiVersion constraints.gatekeeper.sh/v1beta1? or is that just the
// default is /spec/crd doesn't specify an apiVersion?)

// AUDIT
// Audit results are stored in the status field of the constraint instance:
// .status.violations (there is a .status.auditTimestamp for when).

// TODO: deploy for DRY RUN
// - create the constraint instance with .spec.enforcementAction: dryrun
// (default is deny)
// - then you get audits but no actual prevention
// RELATED: turn debug on via the config resource (gatekeeper-system/config)
// https://github.com/open-policy-agent/gatekeeper#debugging

// TODO: there is also a sync section in the GK config (gatekeeper-system/config)
// which brings data into OPA for policies that need to look across multiple resources.
// https://github.com/open-policy-agent/gatekeeper#replicating-data

export interface ConstraintTemplateInfo {
    readonly name: string;
}

export interface ConstraintInfo {
    readonly name: string;
}

export async function listConstraintTemplates(kubectl: k8s.KubectlV1): Promise<Errorable<ConstraintTemplateInfo[]>> {
    const sr = await kubectl.invokeCommand('get constrainttemplates -o json');
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const templatesListResource = JSON.parse(sr.stdout);
    const templates = templatesListResource.items as any[];
    const templatesInfo = templates.map((t) => ({ name: t.metadata.name }));
    return { succeeded: true, result: templatesInfo };
}

export async function listConstraints(kubectl: k8s.KubectlV1, templateName: string): Promise<Errorable<ConstraintInfo[]>> {
    const sr = await kubectl.invokeCommand(`get ${templateName} -o json`);
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const constraintsListResource = JSON.parse(sr.stdout);
    const constraints = constraintsListResource.items as any[];
    const constraintsInfo = constraints.map((c) => ({ name: c.metadata.name }));
    return { succeeded: true, result: constraintsInfo };
}
