import { basename, isAbsolute, relative, sep } from "node:path";

import type { ExplorationToolCallPresentation } from "../../agent/ToolCallPresentation.js";
import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";

export function readToolCallPresentation(
    path: string,
    context: AgentContext,
): ExplorationToolCallPresentation {
    return {
        type: "exploration",
        operations: [{ kind: "read", name: basename(displayPath(path, context)) || path }],
    };
}

export function listToolCallPresentation(
    path: string,
    context: AgentContext,
    pattern?: string,
): ExplorationToolCallPresentation {
    const displayedPath = displayPath(path, context);
    return {
        type: "exploration",
        operations: [
            {
                kind: "list",
                target:
                    pattern === undefined
                        ? displayedPath
                        : displayedPath === "."
                          ? pattern
                          : `${pattern} in ${displayedPath}`,
            },
        ],
    };
}

export function searchToolCallPresentation(
    query: string,
    path: string | undefined,
    context: AgentContext,
): ExplorationToolCallPresentation {
    const displayedPath = path === undefined ? undefined : displayPath(path, context);
    return {
        type: "exploration",
        operations: [
            {
                command: query,
                kind: "search",
                query,
                ...(displayedPath === undefined ? {} : { path: displayedPath }),
            },
        ],
    };
}

function displayPath(path: string, context: AgentContext): string {
    const resolved = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
    const fromCwd = relative(context.fs.cwd, resolved);
    if (fromCwd.length === 0) return ".";
    if (!fromCwd.startsWith(`..${sep}`) && fromCwd !== ".." && !isAbsolute(fromCwd)) {
        return fromCwd.split(sep).join("/");
    }
    return resolved.split(sep).join("/");
}
