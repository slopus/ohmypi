import type { AnyDefinedTool } from "./types.js";
import type { Model, Provider } from "../providers/types.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import { codexTools } from "../tools/codex/index.js";
import { grokBuildTools } from "../tools/grok/index.js";
import { piTools } from "../tools/pi/index.js";

export interface SelectToolsForModelOptions {
    provider: Provider;
    model: Model;
}

export function selectToolsForModel(
    options: SelectToolsForModelOptions,
): readonly AnyDefinedTool[] {
    const identity = [options.provider.id, options.model.id, options.model.name]
        .join(" ")
        .toLowerCase();

    if (options.model.id.toLowerCase().startsWith("xai/") || identity.includes("grok")) {
        return grokBuildTools;
    }

    if (identity.includes("codex") || identity.includes("openai") || identity.includes("gpt")) {
        return codexTools;
    }

    if (
        identity.includes("anthropic") ||
        identity.includes("claude") ||
        identity.includes("sonnet") ||
        identity.includes("opus") ||
        identity.includes("haiku")
    ) {
        return claudeCodeTools;
    }

    return piTools;
}
