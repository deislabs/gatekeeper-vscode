import * as tmp from 'tmp';

import { fs } from './fs';

const TEMPFILE_PREFIX = 'gk-vscode-';

export async function withTempFile<T>(content: string, fileType: string, fn: (filename: string) => Promise<T>): Promise<T> {
    const tempFile = tmp.fileSync({ prefix: TEMPFILE_PREFIX, postfix: `.${fileType}` });
    await fs.writeFile(tempFile.name, content);

    try {
        return await fn(tempFile.name);
    } finally {
        tempFile.removeCallback();
    }
}
