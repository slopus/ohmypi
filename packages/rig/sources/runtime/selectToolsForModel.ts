import type { AnyDefinedTool } from "../agent/types.js";
import type { Model, Provider } from "../providers/types.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import { codexTools } from "../tools/codex/index.js";
import { grokBuildTools } from "../tools/grok/index.js";
import { kimiCodeTools } from "../tools/kimi/index.js";
import { piTools } from "../tools/pi/index.js";
import { createGeminiTools } from "../tools/gemini/createGeminiTools.js";
import { resolveModelProfileForProvider } from "../profiles/impl/resolveModelProfileForProvider.js";

export interface SelectToolsForModelOptions {
    geminiApiKey?: string;
    provider: Provider;
    model: Model;
}

export function selectToolsForModel(
    options: SelectToolsForModelOptions,
): readonly AnyDefinedTool[] {
    const toolProfile = options.provider.toolProfile(options.model);
    const profile = resolveModelProfileForProvider(options.provider, options.model);
    const baseTools =
        profile !== undefined && profile.toolProfile === toolProfile
            ? profile.tools.base
            : (() => {
                  switch (toolProfile) {
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
