import type { Model } from "../../providers/types.js";

export function resolveCompactionThinking(model: Model): string {
    if (model.thinkingLevels.includes("low")) return "low";
    if (model.thinkingLevels.includes("minimal")) return "minimal";
    if (model.thinkingLevels.includes("off")) return "off";
    return model.defaultThinkingLevel;
}
