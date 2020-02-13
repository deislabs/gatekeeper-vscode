import { Uri, EventEmitter, FileChangeEvent, FileSystemProvider, Event, Disposable, FileStat, FileType, window } from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as path from 'path';
import * as fs from 'fs';
import * as querystring from 'querystring';
import { longRunning, selectRootFolder } from '../utils/host';
import { getRegoFromTemplate } from '../gatekeeper';
import { failed } from '../utils/errorable';

export const GK_REGO_RESOURCE_SCHEME = "gkrego";
export const GK_REGO_RESOURCE_AUTHORITY = "constrainttemplates";

export function regoUri(templateName: string): Uri {
    const docname = `${templateName}.rego`;
    const nonce = new Date().getTime();
    const uri = `${GK_REGO_RESOURCE_SCHEME}://${GK_REGO_RESOURCE_AUTHORITY}/${docname}?template=${templateName}&_=${nonce}`;
    return Uri.parse(uri);
}

export class ConstraintTemplateRegoFileSystemProvider implements FileSystemProvider {
    constructor(private readonly kubectl: k8s.KubectlV1) { }

    private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    watch(_uri: Uri, _options: { recursive: boolean; excludes: string[] }): Disposable {
        // It would be quite neat to implement this to watch for changes
        // in the cluster and update the doc accordingly.  But that is very
        // definitely a future enhancement thing!
        return new Disposable(() => {});
    }

    stat(_uri: Uri): FileStat {
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // These files don't seem to matter for us
        };
    }

    readDirectory(_uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(_uri: Uri): void | Thenable<void> {
        // no-op
    }

    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        return this.readFileAsync(uri);
    }

    async readFileAsync(uri: Uri): Promise<Uint8Array> {
        const content = await this.loadResource(uri);
        return new Buffer(content, 'utf8');
    }

    async loadResource(uri: Uri): Promise<string> {
        const query = querystring.parse(uri.query);

        const templateName = query.template as string;

        const sr = await this.execLoadTemplate(templateName);

        if (!sr || sr.code !== 0) {
            const message = sr ? sr.stderr : "Unable to run command line tool";
            window.showErrorMessage('Getting template failed: ' + message);
            throw message;
        }

        const template = JSON.parse(sr.stdout);

        const rego = getRegoFromTemplate(template);
        if (failed(rego)) {
            window.showErrorMessage('Getting template failed: ' + rego.error[0]);
            throw rego.error[0];
        }

        return rego.result;
    }

    async execLoadTemplate(templateName: string): Promise<k8s.KubectlV1.ShellResult | undefined> {
        return await longRunning(`Getting constraint template ${templateName}`, () =>
            this.kubectl.invokeCommand(`-o json get constrainttemplate/${templateName}`)
        );
    }

    writeFile(uri: Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void | Thenable<void> {
        return this.saveAsync(uri, content);  // TODO: respect options
    }

    private async saveAsync(uri: Uri, content: Uint8Array): Promise<void> {
        // This assumes no pathing in the URI - if this changes, we'll need to
        // create subdirectories.
        // TODO: not loving prompting as part of the write when it should really be part of a separate
        // 'save' workflow - but needs must, I think
        const rootPath = await selectRootFolder();
        if (!rootPath) {
            return;
        }
        const fspath = path.join(rootPath, uri.fsPath);
        fs.writeFileSync(fspath, content);
    }

    delete(_uri: Uri, _options: { recursive: boolean }): void | Thenable<void> {
        // no-op
    }

    rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }
}
