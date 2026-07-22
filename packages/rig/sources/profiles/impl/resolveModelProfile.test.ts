import { describe, expect, it } from "vitest";

import { resolveModelProfile } from "./resolveModelProfile.js";
import { resolveModelProfileForProvider } from "./resolveModelProfileForProvider.js";
import { createCodexProvider } from "../../providers/codex.js";
import { modelOpenaiGpt56Sol } from "../../providers/models.js";
import { defineProvider } from "../../providers/types.js";

describe("resolveModelProfile", () => {
    it("uses the stable provider type for named provider accounts", () => {
        const provider = createCodexProvider({ apiKey: "test", id: "work_codex" });

        expect(provider.id).toBe("work_codex");
        expect(provider.profileType).toBe("codex");
        expect(resolveModelProfile(provider.profileType, modelOpenaiGpt56Sol.id)?.id).toBe(
            "codex:openai/gpt-5.6-sol",
        );
    });

    it("keeps first-party Codex and Bedrock profiles distinct for the same model id", () => {
        const codex = resolveModelProfile("codex", modelOpenaiGpt56Sol.id);
        const bedrock = resolveModelProfile("bedrock", modelOpenaiGpt56Sol.id);

        expect(codex).toBeDefined();
        expect(bedrock).toBeDefined();
        expect(codex).not.toBe(bedrock);
        expect(codex?.parameters.contextWindow).toBe(372_000);
        expect(codex?.parameters.serviceTiers).toEqual(["fast"]);
        expect(bedrock?.parameters.contextWindow).toBe(272_000);
        expect(bedrock?.parameters.serviceTiers).toEqual([]);
    });

    it("falls back to provider-owned tool capabilities when profileType is absent", () => {
        const provider = defineProvider({
            id: "custom-openai-account",
            models: [modelOpenaiGpt56Sol],
            toolProfile: () => "codex",
            stream: () => {
                throw new Error("Inference is not used by this test.");
            },
        });

        expect(resolveModelProfileForProvider(provider, modelOpenaiGpt56Sol)?.providerType).toBe(
            "codex",
        );
    });

    it("does not guess a Bedrock profile for a profile-less Pi-compatible provider", () => {
        const provider = defineProvider({
            id: "custom-pi-provider",
            models: [modelOpenaiGpt56Sol],
            toolProfile: () => "pi",
            stream: () => {
                throw new Error("Inference is not used by this test.");
            },
        });

        expect(resolveModelProfileForProvider(provider, modelOpenaiGpt56Sol)).toBeUndefined();
    });

    it("fails closed when an explicit provider type has no matching profile", () => {
        const provider = defineProvider({
            id: "misconfigured-claude-provider",
            profileType: "claude",
            models: [modelOpenaiGpt56Sol],
            toolProfile: () => "codex",
            stream: () => {
                throw new Error("Inference is not used by this test.");
            },
        });

        expect(resolveModelProfileForProvider(provider, modelOpenaiGpt56Sol)).toBeUndefined();
    });
});
