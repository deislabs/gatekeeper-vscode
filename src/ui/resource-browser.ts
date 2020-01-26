import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { GATEKEEPER_RESOURCE_KINDS } from '../gatekeeper';

export namespace ResourceBrowser {
    export function create(kubectl: k8s.KubectlV1, clusterExplorer: k8s.ClusterExplorerV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        const resourceFolders = GATEKEEPER_RESOURCE_KINDS.map((k) => clusterExplorer.nodeSources.resourceFolder(k.displayName, k.pluralDisplayName, k.manifestKind, k.abbreviation));
        return clusterExplorer.nodeSources.groupingFolder("Gatekeeper", undefined, ...resourceFolders).at(undefined);

        // Real world:
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

        // So... how do we render this?  E.g.
        // + Gatekeeper
        //   + RequiredLabels  // NOTE: metadata.name is k8srequiredlabels - do we prefer this or the .spec.names.kind as shown
        //     + ns-must-have-gk
        //     + deployment-must-have-git-tag
        //   + ApprovedImages
        //     + images-must-be-from-private-registry
        //     + images-must-not-be-latest
        // TODO: Should we show a list of constraint templates as leaf items?
        // TODO: Should we show the constraints as a flat list?
        // TODO: Should we show the gatekeeper-system/config resource as a special editable thing?

        // TODO: how does this all work with namespaces?  (The samples all deploy into the current
        // (or default?) NS - what does it mean to have a constraint template or constraint in a
        // different NS?)

        // AUDIT
        // Audit results are stored in the status field of the constraint instance:
        // .status.violations (there is a .status.auditTimestamp for when).

        // TODO: ELSEWHERE: deploy for DRY RUN
        // - create the constraint instance with .spec.enforcementAction: dryrun
        // (default is deny)
        // - then you get audits but no actual prevention
        // RELATED: turn debug on via the config resource (gatekeeper-system/config)
        // https://github.com/open-policy-agent/gatekeeper#debugging

        // TODO: there is also a sync section in the GK config (gatekeeper-system/config)
        // which brings data into OPA for policies that need to look across multiple resources.
        // https://github.com/open-policy-agent/gatekeeper#replicating-data
    }
}
