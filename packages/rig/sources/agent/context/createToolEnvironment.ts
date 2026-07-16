import { delimiter } from "node:path";

import type { PermissionMode } from "../../permissions/index.js";
import { findExecutableSearchPaths } from "./findExecutableSearchPaths.js";
import { createShellEnvironment } from "./createShellEnvironment.js";

export async function createToolEnvironment(
    mode: PermissionMode,
    environment: NodeJS.ProcessEnv = process.env,
    options: {
        cwd?: string;
        homeDirectory?: string;
        temporaryDirectory?: string;
    } = {},
): Promise<NodeJS.ProcessEnv> {
    const filtered = createShellEnvironment(environment);
    if (mode === "full_access" || process.platform === "win32") return filtered;
    return {
        ...filtered,
        PATH: (
            await findExecutableSearchPaths({
                cwd: options.cwd ?? process.cwd(),
                environment,
                ...(options.homeDirectory === undefined
                    ? {}
                    : { homeDirectory: options.homeDirectory }),
                ...(options.temporaryDirectory === undefined
                    ? {}
                    : { temporaryDirectory: options.temporaryDirectory }),
            })
        ).join(delimiter),
    };
}
