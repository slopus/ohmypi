import type { FileSystemContext } from "../context/FileSystemContext.js";

export async function isDirectoryAtPath(fs: FileSystemContext, path: string): Promise<boolean> {
    try {
        return (await fs.stat(path)).isDirectory;
    } catch {
        return false;
    }
}
