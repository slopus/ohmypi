import type { AgentContext } from "../../agent/context/AgentContext.js";
import { getClaudeCanonicalProjectRoot } from "./getClaudeCanonicalProjectRoot.js";

const cache = new WeakMap<AgentContext, Promise<string>>();

export function getCachedClaudeProjectRoot(
    context: AgentContext,
    fallbackRoot: string,
): Promise<string> {
    const existing = cache.get(context);
    if (existing !== undefined) return existing;
    const projectRoot = getClaudeCanonicalProjectRoot(context.bash, context.fs.cwd, fallbackRoot);
    cache.set(context, projectRoot);
    return projectRoot;
}
