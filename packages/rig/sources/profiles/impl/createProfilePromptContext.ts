import { homedir } from "node:os";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import type { Model, Provider } from "../../providers/types.js";
import type { ModelProfile, ProfilePromptContext } from "./types.js";
import { getCachedClaudeRepositoryContext } from "../claude/getCachedClaudeRepositoryContext.js";
import { getClaudeOsVersion } from "../claude/getClaudeOsVersion.js";
import { extendProfilePromptContext } from "./extendProfilePromptContext.js";

export async function createProfilePromptContext(options: {
    agentContext: AgentContext;
    effort?: string;
    model: Model;
    profile: ModelProfile | undefined;
    provider: Provider;
}): Promise<ProfilePromptContext> {
    const base = {
        ...(options.effort === undefined ? {} : { effort: options.effort }),
        modelId: options.model.id,
        providerId: options.provider.id,
    };
    if (options.profile?.vendor !== "anthropic") {
        return extendProfilePromptContext(options.provider, base);
    }

    const repositoryContext = await getCachedClaudeRepositoryContext(options.agentContext);
    return extendProfilePromptContext(options.provider, {
        ...base,
        ...repositoryContext,
        cwd: options.agentContext.fs.cwd,
        home: options.agentContext.fs.home ?? homedir(),
        osVersion: getClaudeOsVersion(),
        platform: process.platform,
        ...(process.env.SHELL === undefined ? {} : { shell: process.env.SHELL }),
    });
}
