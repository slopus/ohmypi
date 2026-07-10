import type { NativeProxessManager } from "../../processes/index.js";
import type { AgentContext } from "./AgentContext.js";
import { createNodeBashContext } from "./createNodeBashContext.js";
import { createNodeFileSystemContext } from "./createNodeFileSystemContext.js";
import {
    createPermissionContext,
    DEFAULT_PERMISSION_MODE,
    type PermissionMode,
} from "../../permissions/index.js";

export interface CreateNodeAgentContextOptions {
    cwd: string;
    processManager: NativeProxessManager;
    permissionMode?: PermissionMode;
}

export function createNodeAgentContext(options: CreateNodeAgentContextOptions): AgentContext {
    const permissions = createPermissionContext(options.permissionMode ?? DEFAULT_PERMISSION_MODE);
    return {
        fs: createNodeFileSystemContext(options.cwd, {
            permissionMode: () => permissions.mode,
        }),
        bash: createNodeBashContext({
            cwd: options.cwd,
            processManager: options.processManager,
            permissions,
        }),
        permissions,
    };
}
