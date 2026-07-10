import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { assertCanWritePath } from "./assertCanWritePath.js";
import type { FileSystemContext } from "./FileSystemContext.js";
import type { PermissionMode } from "../../permissions/index.js";

export interface CreateNodeFileSystemContextOptions {
    home?: string;
    permissionMode?: () => PermissionMode;
}

export function createNodeFileSystemContext(
    cwd: string,
    options: CreateNodeFileSystemContextOptions = {},
): FileSystemContext {
    const permissionMode = options.permissionMode ?? (() => "full_access" as const);
    const resolvePath = (path: string) => (isAbsolute(path) ? path : resolve(cwd, path));
    return {
        cwd,
        home: options.home ?? homedir(),
        async exists(path) {
            return existsSync(resolvePath(path));
        },
        async mkdir(path, options) {
            const target = resolvePath(path);
            await assertCanWritePath(cwd, target, permissionMode());
            await mkdir(target, { recursive: options?.recursive ?? false });
        },
        async readFile(path) {
            return readFile(resolvePath(path), "utf8");
        },
        async readFileBuffer(path) {
            return readFile(resolvePath(path));
        },
        async readdir(path) {
            return readdir(resolvePath(path));
        },
        async rm(path, options) {
            const target = resolvePath(path);
            await assertCanWritePath(cwd, target, permissionMode());
            await rm(target, {
                recursive: options?.recursive ?? false,
                force: options?.force ?? false,
            });
        },
        async stat(path) {
            const stats = await stat(resolvePath(path));
            return {
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isSymbolicLink: stats.isSymbolicLink(),
                size: stats.size,
                mtimeMs: stats.mtimeMs,
            };
        },
        async writeFile(path, content) {
            const target = resolvePath(path);
            await assertCanWritePath(cwd, target, permissionMode());
            await writeFile(target, content);
        },
    };
}
