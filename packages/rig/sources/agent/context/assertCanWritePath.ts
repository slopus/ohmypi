import { isPathInsideWorkspace } from "./isPathInsideWorkspace.js";
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

    if (!(await isPathInsideWorkspace(cwd, targetPath))) {
        throw new Error(
            `Workspace write mode cannot modify files outside the working directory: ${cwd}.`,
        );
    }
}
