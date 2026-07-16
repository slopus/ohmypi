import { describe, expect, it } from "vitest";

import { selectToolsForModel } from "./selectToolsForModel.js";
import { createGrokProvider } from "../providers/grok.js";
import { modelXaiGrokBuild } from "../providers/models.js";
import { grokBuildTools } from "../tools/grok/index.js";

describe("selectToolsForModel", () => {
    it("selects the Grok tool surface for Grok models", () => {
        const provider = createGrokProvider({ id: "custom-xai-provider" });

        expect(selectToolsForModel({ model: modelXaiGrokBuild, provider })).toBe(grokBuildTools);
    });
});
