export interface Match {
    readonly index: number;
    readonly groups: ReadonlyArray<string>;
}

export function* exec(text: string, regex: RegExp): IterableIterator<Match> {
    while (true) {
        const match = regex.exec(text);
        if (!match) {
            return;
        }
        yield { index: match.index, groups: match };
    }
}
