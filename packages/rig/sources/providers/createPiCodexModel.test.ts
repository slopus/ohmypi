import { describe, expect, it } from "vitest";

import { createPiCodexModel } from "./createPiCodexModel.js";
import { defineModel } from "./types.js";

describe("createPiCodexModel", () => {
    it("uses the curated context window without inventing fallback pricing", () => {
        const model = defineModel({
            id: "openai/gpt-future",
            name: "GPT Future",
            thinkingLevels: ["off", "high"],
            defaultThinkingLevel: "high",
            contextWindow: 272_000,
        });

        expect(createPiCodexModel(model, "gpt-future")).toMatchObject({
            id: "gpt-future",
            contextWindow: 272_000,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
            },
        });
    });

    it("rejects a fallback model whose context window is not curated", () => {
        const model = defineModel({
            id: "openai/gpt-unknown",
            name: "GPT Unknown",
            thinkingLevels: ["off"],
            defaultThinkingLevel: "off",
        });

        expect(() => createPiCodexModel(model, "gpt-unknown")).toThrow(
            "Codex model openai/gpt-unknown is missing its context window.",
        );
    });
});
