import { describe, expect, it } from "vitest";

import { modelAnthropicFable5, modelOpenaiGpt56Sol } from "../../providers/models.js";
import { modelProfileSupportsEncryptedAgentMessages } from "./modelProfileSupportsEncryptedAgentMessages.js";

describe("modelProfileSupportsEncryptedAgentMessages", () => {
    it("recognizes Codex v2 profiles only on the native Codex provider", () => {
        expect(modelProfileSupportsEncryptedAgentMessages("codex", modelOpenaiGpt56Sol.id)).toBe(
            true,
        );
        expect(modelProfileSupportsEncryptedAgentMessages("bedrock", modelOpenaiGpt56Sol.id)).toBe(
            false,
        );
    });

    it("does not infer support from Bedrock or a provider name alone", () => {
        expect(modelProfileSupportsEncryptedAgentMessages("bedrock", modelAnthropicFable5.id)).toBe(
            false,
        );
        expect(modelProfileSupportsEncryptedAgentMessages("claude", modelAnthropicFable5.id)).toBe(
            false,
        );
    });
});
