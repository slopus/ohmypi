import { describe, expect, it, vi } from "vitest";

import { createJustBashToolHarness } from "../../tools/testing/createJustBashToolHarness.js";
import { defineModel, defineProvider } from "../../providers/types.js";
import { createProfilePromptContext } from "./createProfilePromptContext.js";

describe("createProfilePromptContext", () => {
    it("allows any provider to extend its profile prompt context", async () => {
        const harness = createJustBashToolHarness();
        const model = defineModel({
            defaultThinkingLevel: "off",
            id: "test/profile-context",
            name: "Profile context",
            thinkingLevels: ["off"],
        });
        const extendProfilePromptContext = vi.fn(async (context) => ({
            ...context,
            cwd: "/provider/context",
        }));
        const provider = defineProvider({
            extendProfilePromptContext,
            id: "test-provider",
            models: [model],
            stream: () => {
                throw new Error("Inference is not used by this test.");
            },
        });

        await expect(
            createProfilePromptContext({
                agentContext: harness.context,
                model,
                profile: undefined,
                provider,
            }),
        ).resolves.toEqual({
            cwd: "/provider/context",
            modelId: model.id,
            providerId: provider.id,
        });
        expect(extendProfilePromptContext).toHaveBeenCalledWith({
            modelId: model.id,
            providerId: provider.id,
        });
    });
});
