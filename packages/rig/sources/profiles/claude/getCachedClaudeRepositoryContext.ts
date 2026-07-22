import type { AgentContext } from "../../agent/context/AgentContext.js";
import { findProjectRoot } from "../../agent/findProjectRoot.js";
import type { ProfilePromptContext } from "../impl/types.js";
import { getCachedClaudeGitStatus } from "./getCachedClaudeGitStatus.js";
import { getCachedClaudeProjectRoot } from "./getCachedClaudeProjectRoot.js";

type ClaudeRepositoryContext = Pick<
    ProfilePromptContext,
    "claudeGitStatus" | "isGitRepository" | "projectRoot"
>;

const cache = new WeakMap<AgentContext, Promise<ClaudeRepositoryContext>>();

export function getCachedClaudeRepositoryContext(
    context: AgentContext,
): Promise<ClaudeRepositoryContext> {
    const existing = cache.get(context);
    if (existing !== undefined) return existing;
    const snapshot = createClaudeRepositoryContext(context);
    cache.set(context, snapshot);
    return snapshot;
}

async function createClaudeRepositoryContext(
    context: AgentContext,
): Promise<ClaudeRepositoryContext> {
    const detectedProjectRoot = await findProjectRoot(context.fs);
    const projectRoot = await getCachedClaudeProjectRoot(
        context,
        detectedProjectRoot ?? context.fs.cwd,
    );
    const claudeGitStatus =
        detectedProjectRoot === undefined
            ? undefined
            : await getCachedClaudeGitStatus(context, context.fs.cwd);
    return {
        ...(claudeGitStatus === undefined ? {} : { claudeGitStatus }),
        isGitRepository: detectedProjectRoot !== undefined,
        projectRoot,
    };
}
