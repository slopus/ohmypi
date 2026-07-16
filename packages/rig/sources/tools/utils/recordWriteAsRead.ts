import type { AgentContext } from "../../agent/context/AgentContext.js";

// After a successful write the agent knows the file's contents, so refresh the
// recorded read state to the new on-disk mtime; otherwise the next edit in the
// same turn would be rejected as stale.
export async function recordWriteAsRead(filePath: string, context: AgentContext): Promise<void> {
    if (!context.fileReads) return;
    const stats = await context.fs.stat(filePath);
    context.fileReads.recordRead(filePath, stats.mtimeMs);
}
