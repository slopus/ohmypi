import { lstat, readlink, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";

import type { PermissionMode } from "../../permissions/index.js";

export async function assertCanWritePath(
    cwd: string,
    targetPath: string,
    mode: PermissionMode,
): Promise<void> {
    if (mode === "full_access") return;
    if (mode === "read_only") {
        throw new Error("File changes are disabled in read-only mode.");
    }

    const root = await realpath(cwd);
    const target = isAbsolute(targetPath) ? targetPath : resolve(cwd, targetPath);
    const canonicalTarget = await resolvePotentialPath(target);
    if (canonicalTarget !== root && !canonicalTarget.startsWith(`${root}${sep}`)) {
        throw new Error(
            `Workspace write mode cannot modify files outside the working directory: ${cwd}.`,
        );
    }
}

async function resolvePotentialPath(target: string, symlinkDepth = 0): Promise<string> {
    if (symlinkDepth > 40) throw new Error(`Cannot resolve symbolic link chain for ${target}.`);

    const pathRoot = parse(target).root;
    const parts = target.slice(pathRoot.length).split(sep).filter(Boolean);
    let current = pathRoot;
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (part === undefined) continue;
        const candidate = join(current, part);
        try {
            const metadata = await lstat(candidate);
            if (metadata.isSymbolicLink()) {
                const destination = resolve(dirname(candidate), await readlink(candidate));
                return resolvePotentialPath(
                    join(destination, ...parts.slice(index + 1)),
                    symlinkDepth + 1,
                );
            }
            current = candidate;
        } catch (error) {
            if (
                error instanceof Error &&
                "code" in error &&
                (error as NodeJS.ErrnoException).code === "ENOENT"
            ) {
                return join(current, ...parts.slice(index));
            }
            throw error;
        }
    }
    return current;
}
