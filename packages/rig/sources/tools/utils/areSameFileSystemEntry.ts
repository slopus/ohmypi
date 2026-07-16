import type { FileSystemContext } from "../../agent/context/FileSystemContext.js";

export async function areSameFileSystemEntry(
    fs: FileSystemContext,
    left: string,
    right: string,
): Promise<boolean> {
    try {
        const [canonicalLeft, canonicalRight] = await Promise.all([
            fs.realpath(left),
            fs.realpath(right),
        ]);
        return canonicalLeft === canonicalRight;
    } catch {
        return false;
    }
}
