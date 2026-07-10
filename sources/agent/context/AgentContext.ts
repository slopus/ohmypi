import type { BashContext } from "./BashContext.js";
import type { FileSystemContext } from "./FileSystemContext.js";
import type { SubagentContext } from "./SubagentContext.js";

export interface AgentContext {
    fs: FileSystemContext;
    bash: BashContext;
    subagents?: SubagentContext;
}
