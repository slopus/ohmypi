import type { FileSystemStat } from "./FileSystemContext.js";

export function toFileSystemStat(stats: {
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    size: number;
    mtime: Date;
}): FileSystemStat {
    return {
        isFile: stats.isFile,
        isDirectory: stats.isDirectory,
        isSymbolicLink: stats.isSymbolicLink,
        size: stats.size,
        mtimeMs: stats.mtime.getTime(),
    };
}
