import { describe, expect, it } from "vitest";

import { selectToolsForModel } from "./selectToolsForModel.js";
import { createGrokProvider } from "../providers/grok.js";
import { modelXaiGrokBuild } from "../providers/models.js";
import { defineProvider, type ProviderToolProfile } from "../providers/types.js";
import { grokBuildTools } from "../tools/grok/index.js";
import { createKimiProvider } from "../providers/kimi.js";
import { modelMoonshotKimiK3 } from "../providers/models.js";
import { kimiCodeTools } from "../tools/kimi/index.js";
import { piTools } from "../tools/pi/index.js";

describe("selectToolsForModel", () => {
    it("selects the Grok tool surface for Grok models", () => {
        const provider = createGrokProvider({ id: "custom-xai-provider" });

        expect(selectToolsForModel({ model: modelXaiGrokBuild, provider })).toBe(grokBuildTools);
    });

    it("uses provider-owned capabilities instead of provider or model names", () => {
        const provider = defineProvider({
            id: "grok-compatible-provider",
            models: [modelXaiGrokBuild],
            toolProfile: () => "pi",
            stream: () => {
                throw new Error("Inference is not used by this test.");
            },
        });

        expect(selectToolsForModel({ model: modelXaiGrokBuild, provider })).toBe(piTools);
    });

    it("selects Kimi's capitalized tool surface for K3", () => {
        const provider = createKimiProvider();

        expect(selectToolsForModel({ model: modelMoonshotKimiK3, provider })).toBe(kimiCodeTools);
    });

    it("adds every universal Gemini tool to every provider-owned tool profile", () => {
        for (const toolProfile of ["claude", "codex", "grok", "kimi", "pi"] as const) {
            const provider = providerWithToolProfile(toolProfile);

            const tools = selectToolsForModel({
                geminiApiKey: "gemini-key",
                model: modelXaiGrokBuild,
                provider,
            });

            expect(tools.map((tool) => tool.name)).toEqual(
                expect.arrayContaining([
                    "gemini_search",
                    "gemini_generate_image",
                    "gemini_generate_music",
                    "gemini_analyze_media",
                ]),
            );
            if (toolProfile === "claude") {
                expect(tools.filter((tool) => tool.name === "WebSearch")).toHaveLength(1);
            }
        }
    });
});

function providerWithToolProfile(toolProfile: ProviderToolProfile) {
    return defineProvider({
        id: `${toolProfile}-compatible-provider`,
        models: [modelXaiGrokBuild],
        toolProfile: () => toolProfile,
        stream: () => {
            throw new Error("Inference is not used by this test.");
        },
    });
}
