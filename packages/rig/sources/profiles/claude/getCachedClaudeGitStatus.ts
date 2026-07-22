import type { AgentContext } from "../../agent/context/AgentContext.js";
import { createClaudeGitStatus } from "./createClaudeGitStatus.js";

const cache = new WeakMap<AgentContext, Promise<string | undefined>>();

export function getCachedClaudeGitStatus(
    context: AgentContext,
    cwd: string,
): Promise<string | undefined> {
    const existing = cache.get(context);
    if (existing !== undefined) return existing;
    const status = createClaudeGitStatus(context.bash, cwd);
    cache.set(context, status);
    return status;
}
