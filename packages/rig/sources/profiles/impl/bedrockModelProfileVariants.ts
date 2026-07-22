import { claudeAnthropicFable5Profile } from "../claude-fable-5.js";
import { claudeAnthropicOpus48Profile } from "../claude-opus-4-8.js";
import { claudeAnthropicSonnet5Profile } from "../claude-sonnet-5.js";
import { codexOpenaiGpt56LunaProfile } from "../codex-gpt-5-6-luna.js";
import { codexOpenaiGpt56SolProfile } from "../codex-gpt-5-6-sol.js";
import { codexOpenaiGpt56TerraProfile } from "../codex-gpt-5-6-terra.js";
import type { Model } from "../../providers/types.js";
import { createModelProfileVariant } from "./createModelProfileVariant.js";
import { withoutProfilePromptAppend } from "./withoutProfilePromptAppend.js";

// Bedrock transport variants intentionally reuse the vendor/model profiles instead of
// introducing duplicate top-level profiles. Unlike the official Claude Code and Codex
// clients, they use AWS credentials, endpoints, regions, and Bedrock request formats.

export const bedrockAnthropicFable5Profile = createModelProfileVariant(
    claudeAnthropicFable5Profile,
    {
        profileType: "bedrock",
        wireMode: "bedrock-mantle-or-runtime",
    },
);
export const bedrockAnthropicOpus48Profile = createModelProfileVariant(
    claudeAnthropicOpus48Profile,
    {
        profileType: "bedrock",
        wireMode: "bedrock-mantle-or-runtime",
    },
);
export const bedrockAnthropicSonnet5Profile = createModelProfileVariant(
    claudeAnthropicSonnet5Profile,
    {
        profileType: "bedrock",
        wireMode: "bedrock-mantle-or-runtime",
    },
);

export const modelBedrockOpenaiGpt56Sol: Model = {
    ...codexOpenaiGpt56SolProfile.model,
    contextWindow: 272_000,
    thinkingLevels: codexOpenaiGpt56SolProfile.model.thinkingLevels.filter(
        (level) => level !== "ultra",
    ),
};

// Bedrock GPT-5.6 is capped at 272k context. Sol and Terra omit Rig's Ultra level and
// its prompt append because those routes do not support it.
export const modelBedrockOpenaiGpt56Terra: Model = {
    ...codexOpenaiGpt56TerraProfile.model,
    contextWindow: 272_000,
    thinkingLevels: codexOpenaiGpt56TerraProfile.model.thinkingLevels.filter(
        (level) => level !== "ultra",
    ),
};
export const modelBedrockOpenaiGpt56Luna: Model = {
    ...codexOpenaiGpt56LunaProfile.model,
    contextWindow: 272_000,
};

export const bedrockOpenaiGpt56LunaProfile = createModelProfileVariant(
    codexOpenaiGpt56LunaProfile,
    {
        profileType: "bedrock",
        wireMode: "bedrock-mantle-or-runtime",
        model: modelBedrockOpenaiGpt56Luna,
    },
);
export const bedrockOpenaiGpt56SolProfile = createModelProfileVariant(codexOpenaiGpt56SolProfile, {
    profileType: "bedrock",
    wireMode: "bedrock-mantle-or-runtime",
    model: modelBedrockOpenaiGpt56Sol,
    prompt: withoutProfilePromptAppend(
        codexOpenaiGpt56SolProfile.prompt,
        "codex-ultra-multi-agent",
    ),
});
export const bedrockOpenaiGpt56TerraProfile = createModelProfileVariant(
    codexOpenaiGpt56TerraProfile,
    {
        profileType: "bedrock",
        wireMode: "bedrock-mantle-or-runtime",
        model: modelBedrockOpenaiGpt56Terra,
        prompt: withoutProfilePromptAppend(
            codexOpenaiGpt56TerraProfile.prompt,
            "codex-ultra-multi-agent",
        ),
    },
);
