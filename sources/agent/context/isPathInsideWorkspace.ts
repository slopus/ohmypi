import { realpath } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";

import { resolvePotentialPath } from "./resolvePotentialPath.js";

export async function isPathInsideWorkspace(cwd: string, path: string): Promise<boolean> {
    try {
        const root = await realpath(cwd);
        const target = isAbsolute(path) ? path : resolve(cwd, path);
        const canonicalTarget = await resolvePotentialPath(target);
        return canonicalTarget === root || canonicalTarget.startsWith(`${root}${sep}`);
    } catch {
        return false;
    }
}
