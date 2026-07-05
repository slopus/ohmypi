import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";

import type { FileSystemContext } from "./FileSystemContext.js";

export interface CreateNodeFileSystemContextOptions {
    home?: string;
}

export function createNodeFileSystemContext(
    cwd: string,
    options: CreateNodeFileSystemContextOptions = {},
): FileSystemContext {
    return {
        cwd,
        home: options.home ?? homedir(),
        async exists(path) {
            return existsSync(path);
        },
        async mkdir(path, options) {
            await mkdir(path, { recursive: options?.recursive ?? false });
        },
        async readFile(path) {
            return readFile(path, "utf8");
        },
        async readFileBuffer(path) {
            return readFile(path);
        },
        async readdir(path) {
            return readdir(path);
        },
        async rm(path, options) {
            await rm(path, {
                recursive: options?.recursive ?? false,
                force: options?.force ?? false,
            });
        },
        async stat(path) {
            const stats = await stat(path);
            return {
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isSymbolicLink: stats.isSymbolicLink(),
                size: stats.size,
                mtimeMs: stats.mtimeMs,
            };
        },
        async writeFile(path, content) {
            await writeFile(path, content);
        },
    };
}
