import { AsyncLocalStorage } from "node:async_hooks";

import type { PermissionContext } from "./PermissionContext.js";
import type { PermissionMode } from "./PermissionMode.js";

export function createPermissionContext(initialMode: PermissionMode): PermissionContext {
    const overrides = new AsyncLocalStorage<PermissionMode>();
    let configuredMode = initialMode;
    return {
        get mode() {
            return overrides.getStore() ?? configuredMode;
        },
        runWithMode(mode, action) {
            return Promise.resolve(overrides.run(mode, action));
        },
        setMode(mode) {
            configuredMode = mode;
        },
    };
}
