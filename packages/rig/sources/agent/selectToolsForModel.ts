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
    switch (options.provider.toolProfile(options.model)) {
        case "claude":
            return claudeCodeTools;
        case "codex":
            return codexTools;
        case "grok":
            return grokBuildTools;
        case "pi":
            return piTools;
    }
}
