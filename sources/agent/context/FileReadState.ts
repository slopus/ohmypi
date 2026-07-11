export interface FileReadState {
    recordRead(path: string, mtimeMs: number): void;
    getReadMtime(path: string): number | undefined;
}

export function createFileReadState(): FileReadState {
    const reads = new Map<string, number>();
    return {
        recordRead(path, mtimeMs) {
            reads.set(path, mtimeMs);
        },
        getReadMtime(path) {
            return reads.get(path);
        },
    };
}
