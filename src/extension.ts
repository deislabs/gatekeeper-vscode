import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { install } from './commands/install';
import { unavailableMessage } from './utils/host';
import { ResourceBrowser } from './ui/resource-browser';
import { showViolations } from './commands/showViolations';
import { showResource } from './commands/showResource';
import { showRego } from './commands/showRego';
import { ConstraintTemplateRegoFileSystemProvider, GK_REGO_RESOURCE_SCHEME } from './ui/rego-only.vfs';
import * as diagnostics from './diagnostics/diagnostics';
import { GatekeeperCodeActionProvider } from './diagnostics/codeactionprovider';
import { setEnforcementAction } from './commands/setEnforcementAction';
import { deployTemplate } from './commands/deployTemplate';
import { parametersSchema } from './commands/parametersSchema';

export async function activate(context: vscode.ExtensionContext) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;

    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Can't run Gatekeeper extension: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    } else if (!kubectl.available) {
        vscode.window.showWarningMessage(`Can't run Gatekeeper extension: ${unavailableMessage(kubectl.reason)}`);
        return;
    }

    const regoSelector = { language: 'rego', scheme: 'file' };

    const regofs = new ConstraintTemplateRegoFileSystemProvider(kubectl.api);
    const codeActionProvider = GatekeeperCodeActionProvider.create();

    const disposables = [
        vscode.commands.registerCommand('gatekeeper.install', install),
        vscode.commands.registerCommand('gatekeeper.show', showResource),
        vscode.commands.registerCommand('gatekeeper.showRego', showRego),
        vscode.commands.registerCommand('gatekeeper.enforcementAction', setEnforcementAction),
        vscode.commands.registerCommand('gatekeeper.violations', showViolations),
        vscode.commands.registerTextEditorCommand('gatekeeper.deployTemplate', deployTemplate),
        vscode.commands.registerTextEditorCommand('gatekeeper.schema', parametersSchema),
        vscode.languages.registerCodeActionsProvider(regoSelector, codeActionProvider, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
        vscode.workspace.registerFileSystemProvider(GK_REGO_RESOURCE_SCHEME, regofs),
    ];

    context.subscriptions.push(...disposables);

    clusterExplorer.api.registerNodeContributor(ResourceBrowser.create(kubectl.api, context));

    diagnostics.initialise();
}

export function deactivate() {
}
