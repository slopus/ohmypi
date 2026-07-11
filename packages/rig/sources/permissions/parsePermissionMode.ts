import { isPermissionMode } from "./isPermissionMode.js";
import type { PermissionMode } from "./PermissionMode.js";

export function parsePermissionMode(value: unknown): PermissionMode {
    if (isPermissionMode(value)) return value;
    throw new Error("Permission mode must be Auto, Workspace write, Read only, or Full access.");
}
