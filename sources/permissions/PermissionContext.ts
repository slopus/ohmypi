import type { PermissionMode } from "./PermissionMode.js";

export interface PermissionContext {
    readonly mode: PermissionMode;
    runWithMode<T>(mode: PermissionMode, action: () => Promise<T> | T): Promise<T>;
    setMode(mode: PermissionMode): void;
}
