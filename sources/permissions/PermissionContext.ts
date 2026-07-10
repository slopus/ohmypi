import type { PermissionMode } from "./PermissionMode.js";

export interface PermissionContext {
    mode: PermissionMode;
    setMode(mode: PermissionMode): void;
}
