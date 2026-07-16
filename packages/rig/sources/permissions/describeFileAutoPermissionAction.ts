import type { AgentContext } from "../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../agent/context/resolveFileSystemPath.js";
import { quoteVisibleExact } from "./quoteVisibleExact.js";

export function describeFileAutoPermissionAction(
    path: string,
    context: AgentContext,
    operation: string,
): string {
    let resolvedPath = path;
    try {
        resolvedPath = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
    } catch {
        // Preserve malformed input so the approval prompt still shows the proposed path.
    }
    return `${operation} ${quoteVisibleExact(resolvedPath)}. Access: unrestricted filesystem access outside the workspace sandbox`;
}
