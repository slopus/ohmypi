import type { Bash } from "just-bash";

import type { FileSystemContext } from "./FileSystemContext.js";
import { toFileSystemStat } from "./toFileSystemStat.js";

export function createJustBashFileSystemContext(bash: Bash, cwd: string): FileSystemContext {
    return {
        cwd,
        async exists(path) {
            return bash.fs.exists(path);
        },
        async mkdir(path, mkdirOptions) {
            await bash.fs.mkdir(path, mkdirOptions);
        },
        async readFile(path) {
            return bash.fs.readFile(path);
        },
        async readFileBuffer(path) {
            return bash.fs.readFileBuffer(path);
        },
        async readdir(path) {
            return bash.fs.readdir(path);
        },
        async rm(path, rmOptions) {
            await bash.fs.rm(path, rmOptions);
        },
        async stat(path) {
            const stats = await bash.fs.stat(path);
            return toFileSystemStat(stats);
        },
        async writeFile(path, content) {
            await bash.fs.writeFile(path, content);
        },
    };
}
