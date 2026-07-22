import { describe, expect, it } from "vitest";

import { createKimiChatRequest } from "./createKimiChatRequest.js";
import { modelMoonshotKimiK3 } from "./models.js";

describe("createKimiChatRequest", () => {
    it("uses the profile-selected output-token limit", () => {
        expect(
            createKimiChatRequest({
                apiModelId: "k3",
                context: { messages: [] },
                maxCompletionTokens: 12_345,
                model: modelMoonshotKimiK3,
            }).max_completion_tokens,
        ).toBe(12_345);
    });
});
