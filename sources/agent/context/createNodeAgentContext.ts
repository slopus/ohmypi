import type { NativeProxessManager } from "../../processes/index.js";
import type { AgentContext } from "./AgentContext.js";
import { createNodeBashContext } from "./createNodeBashContext.js";
import { createNodeFileSystemContext } from "./createNodeFileSystemContext.js";

export interface CreateNodeAgentContextOptions {
    cwd: string;
    processManager: NativeProxessManager;
}

export function createNodeAgentContext(options: CreateNodeAgentContextOptions): AgentContext {
    return {
        fs: createNodeFileSystemContext(options.cwd),
        bash: createNodeBashContext({
            cwd: options.cwd,
            processManager: options.processManager,
        }),
    };
}
