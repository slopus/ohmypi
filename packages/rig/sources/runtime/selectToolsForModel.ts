import type { AnyDefinedTool } from "../agent/types.js";
import type { Model, Provider } from "../providers/types.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import { codexTools } from "../tools/codex/index.js";
import { grokBuildTools } from "../tools/grok/index.js";
import { kimiCodeTools } from "../tools/kimi/index.js";
import { piTools } from "../tools/pi/index.js";
import { createGeminiTools } from "../tools/gemini/createGeminiTools.js";

export interface SelectToolsForModelOptions {
    geminiApiKey?: string;
    provider: Provider;
    model: Model;
}

export function selectToolsForModel(
    options: SelectToolsForModelOptions,
): readonly AnyDefinedTool[] {
    const baseTools = (() => {
        switch (options.provider.toolProfile(options.model)) {
            case "claude":
                return claudeCodeTools;
            case "codex":
                return codexTools;
            case "grok":
                return grokBuildTools;
            case "kimi":
                return kimiCodeTools;
            case "pi":
                return piTools;
        }
    })();
    if (options.geminiApiKey === undefined) return baseTools;

    return [...baseTools, ...createGeminiTools(options.geminiApiKey)];
}
