import type { AnyDefinedTool } from "../agent/types.js";
import { resolveModelProfileForProvider } from "../profiles/impl/resolveModelProfileForProvider.js";
import type { Model, Provider } from "../providers/types.js";
import { agentTool } from "../tools/Agent.js";
import { sendMessageTool } from "../tools/SendMessage.js";
import { claudeCollaborationTools } from "../tools/claude/index.js";
import { codexCollaborationTools } from "../tools/codex/index.js";
import { grokCollaborationTools } from "../tools/grok/index.js";
import { kimiAgentTool, kimiSendMessageTool } from "../tools/kimi/index.js";

export function selectCollaborationToolsForModel(options: {
    model: Model;
    provider: Provider;
}): readonly AnyDefinedTool[] {
    const toolProfile = options.provider.toolProfile(options.model);
    const profile = resolveModelProfileForProvider(options.provider, options.model);
    if (profile !== undefined && profile.toolProfile === toolProfile) {
        return profile.tools.collaboration;
    }

    switch (toolProfile) {
        case "codex":
            return codexCollaborationTools;
        case "grok":
            return grokCollaborationTools;
        case "kimi":
            return [kimiAgentTool, kimiSendMessageTool];
        case "claude":
            return [agentTool, ...claudeCollaborationTools];
        case "pi":
            return [agentTool, sendMessageTool];
    }
}
