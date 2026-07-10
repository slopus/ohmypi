import type { PermissionMode } from "./PermissionMode.js";

export function isPermissionMode(value: unknown): value is PermissionMode {
    return value === "workspace_write" || value === "read_only" || value === "full_access";
}
