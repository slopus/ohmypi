import type { BashContext } from "./BashContext.js";
import type { FileSystemContext } from "./FileSystemContext.js";

export interface AgentContext {
    fs: FileSystemContext;
    bash: BashContext;
}
