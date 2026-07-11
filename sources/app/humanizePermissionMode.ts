import type { PermissionMode } from "../permissions/index.js";

export function humanizePermissionMode(mode: PermissionMode): string {
    if (mode === "auto") return "Auto";
    if (mode === "workspace_write") return "Workspace write";
    if (mode === "read_only") return "Read only";
    return "Full access";
}
