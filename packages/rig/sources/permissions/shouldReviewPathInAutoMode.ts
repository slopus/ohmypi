import type { AgentContext } from "../agent/context/AgentContext.js";
import { isPathInsideWorkspace } from "../agent/context/isPathInsideWorkspace.js";
import { isProtectedGitControlPath } from "../agent/context/isProtectedGitControlPath.js";
import { resolvePotentialPath } from "../agent/context/resolvePotentialPath.js";
import { resolveFileSystemPath } from "../agent/context/resolveFileSystemPath.js";

export async function shouldReviewPathInAutoMode(
    path: string,
    context: AgentContext,
    options: { write: boolean },
): Promise<boolean> {
    let resolvedPath: string;
    try {
        resolvedPath = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
    } catch {
        return true;
    }
    if (!(await isPathInsideWorkspace(context.fs.cwd, resolvedPath))) return true;
    if (!options.write) return false;
    return (
        isProtectedGitControlPath(resolvedPath) ||
        isProtectedGitControlPath(await resolvePotentialPath(resolvedPath))
    );
}
