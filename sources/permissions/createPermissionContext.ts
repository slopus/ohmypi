import type { PermissionContext } from "./PermissionContext.js";
import type { PermissionMode } from "./PermissionMode.js";

export function createPermissionContext(initialMode: PermissionMode): PermissionContext {
    return {
        mode: initialMode,
        setMode(mode) {
            this.mode = mode;
        },
    };
}
