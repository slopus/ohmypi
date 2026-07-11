import type { AgentContext } from "../../agent/context/AgentContext.js";

/**
 * Guards Write/Edit against modifying a file the agent has not read in this
 * session, and against clobbering changes made on disk since the last read.
 * Expects an already-resolved absolute path. No-op when the context does not
 * track file reads.
 */
export async function assertReadBeforeModify(
    filePath: string,
    context: AgentContext,
): Promise<void> {
    const reads = context.fileReads;
    if (!reads) {
        return;
    }

    if (!(await context.fs.exists(filePath))) {
        return;
    }

    const readMtimeMs = reads.getReadMtime(filePath);
    if (readMtimeMs === undefined) {
        throw new Error(
            `File has not been read yet. Read it first before writing to it: ${filePath}`,
        );
    }

    const stats = await context.fs.stat(filePath);
    if (stats.mtimeMs > readMtimeMs) {
        throw new Error(
            `File has been modified since it was last read, possibly by the user or another process. Read it again before writing to it: ${filePath}`,
        );
    }
}
