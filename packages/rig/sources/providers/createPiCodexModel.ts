import type { Model as PiModel } from "@earendil-works/pi-ai";

import type { Model } from "./types.js";

const CODEX_THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];

export function createPiCodexModel(
    model: Model,
    piModelId: string,
): PiModel<"openai-codex-responses"> {
    if (model.contextWindow === undefined) {
        throw new Error(`Codex model ${model.id} is missing its context window.`);
    }

    return {
        id: piModelId,
        name: model.name,
        api: "openai-codex-responses",
        provider: "openai-codex",
        baseUrl: "https://chatgpt.com/backend-api",
        reasoning: true,
        thinkingLevelMap: Object.fromEntries(
            CODEX_THINKING_LEVELS.map((level) => [
                level,
                model.thinkingLevels.includes(level) ? level : null,
            ]),
        ),
        input: ["text", "image"],
        cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
        },
        contextWindow: model.contextWindow,
        maxTokens: 128_000,
    } as PiModel<"openai-codex-responses">;
}
