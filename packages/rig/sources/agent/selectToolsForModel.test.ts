import { describe, expect, it } from "vitest";

import { selectToolsForModel } from "./selectToolsForModel.js";
import { createGrokProvider } from "../providers/grok.js";
import { modelXaiGrokBuild } from "../providers/models.js";
import { defineProvider } from "../providers/types.js";
import { grokBuildTools } from "../tools/grok/index.js";
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
});
