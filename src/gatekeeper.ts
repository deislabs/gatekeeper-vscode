import * as k8s from 'vscode-kubernetes-tools-api';
import { Errorable } from "./utils/errorable";
import { JSONSchema } from './authoring/associations';

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

// TODO: extract named types
export interface ConstraintTemplateDetail {
    readonly metadata: {
        readonly name: string;
    };
    readonly spec: {
        readonly crd: {
            readonly spec: {
                readonly names: {
                    readonly kind?: string;
                    readonly listKind?: string;
                    readonly plural?: string;
                    readonly singular?: string;
                };
                readonly validation?: {
                    readonly openAPIV3Schema?: JSONSchema;
                };
            };
        };
    };
}

export interface ConstraintInfo {
    readonly name: string;
    readonly status: ConstraintStatus | undefined;
}

export interface ConstraintStatus {
    readonly timestamp: Date;
    readonly violationCount: number;
}

export interface ConstraintDetail {
    readonly name: string;
    readonly templateName: string;
    readonly status: ConstraintStatusDetail | undefined;
}

export interface ConstraintStatusDetail {
    readonly timestamp: Date;
    readonly violations: ReadonlyArray<ConstraintViolation>;
}

export interface ConstraintViolation {
    readonly resource: ResourceId;
    readonly message: string;
}

export interface ResourceId {
    readonly kind: string;
    readonly name: string;
    // TODO: should there be a namespace property for resources other than NSes?
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

export async function getConstraintTemplate(kubectl: k8s.KubectlV1, templateName: string): Promise<Errorable<ConstraintTemplateDetail>> {
    const sr = await kubectl.invokeCommand(`get constrainttemplates/${templateName} -o json`);
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const template = JSON.parse(sr.stdout);
    return { succeeded: true, result: template };
}

export async function listConstraints(kubectl: k8s.KubectlV1, templateName: string): Promise<Errorable<ConstraintInfo[]>> {
    const sr = await kubectl.invokeCommand(`get ${templateName} -o json`);
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const constraintsListResource = JSON.parse(sr.stdout);
    const constraints = constraintsListResource.items as any[];
    const constraintsInfo = constraints.map((c) => constraintInfo(c));
    return { succeeded: true, result: constraintsInfo };
}

export async function getConstraint(kubectl: k8s.KubectlV1, templateName: string, constraintName: string): Promise<Errorable<ConstraintDetail>> {
    const sr = await kubectl.invokeCommand(`get ${templateName}/${constraintName} -o json`);
    if (!sr || sr.code !== 0) {
        const error = sr ? sr.stderr : 'Unable to run kubectl';
        return { succeeded: false, error: [error] };
    }
    const constraint = JSON.parse(sr.stdout);
    const constraintDetail = {
        name: constraintName,
        templateName: templateName,
        status: constraintDetailedStatus(constraint.status)
    };
    return { succeeded: true, result: constraintDetail };
}

function constraintInfo(c: any): ConstraintInfo {
    const name = c.metadata.name;
    const status = constraintStatus(c.status);
    return { name, status };
}

function constraintStatus(status: any): ConstraintStatus | undefined {
    if (!status) {
        return undefined;
    }

    const timestampISO = status.auditTimestamp as string | undefined;
    if (!timestampISO) {
        return undefined;
    }

    // TODO: should flag violation status as unknown if not syncing - but there's
    // really no way to know if resources of interest are synced - could go through
    // .spec.match.kinds if present I guess...?
    const violationCount = status.totalViolations as number | undefined;
    if (violationCount === undefined) {
        return undefined;
    }

    const timestamp = new Date(timestampISO);
    return { timestamp, violationCount };
}

function constraintDetailedStatus(status: any): ConstraintStatusDetail | undefined {
    if (!status) {
        return undefined;
    }

    const timestampISO = status.auditTimestamp as string | undefined;
    if (!timestampISO) {
        return undefined;
    }

    // TODO: better feedback if target resources not synced
    const rawViolations = (status.violations || []) as any[];

    const timestamp = new Date(timestampISO);

    const violations = rawViolations.map((v) => ({
        resource: resourceId(v),
        message: v.message
    }));
    return { timestamp, violations };
}

function resourceId(violation: any): ResourceId {
    return {
        kind: violation.kind,
        name: violation.name,
        // TODO: namespace?
    };
}

export function getRegoFromTemplate(template: any): Errorable<string> {
    if (!template || !template.spec || !template.spec.targets) {
        return { succeeded: false, error: ['No targets or multiple targets'] };
    }
    const rego = template.spec.targets[0].rego;
    if (!rego) {
        return { succeeded: false, error: ['No rego in spec.targets'] };
    }
    return { succeeded: true, result: rego as string };

}
