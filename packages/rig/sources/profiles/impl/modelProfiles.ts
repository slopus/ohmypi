import { claudeAnthropicFable5Profile } from "../claude-fable-5.js";
import { claudeAnthropicOpus48Profile } from "../claude-opus-4-8.js";
import { claudeAnthropicSonnet5Profile } from "../claude-sonnet-5.js";
import { codexOpenaiGpt56LunaProfile } from "../codex-gpt-5-6-luna.js";
import { codexOpenaiGpt56SolProfile } from "../codex-gpt-5-6-sol.js";
import { codexOpenaiGpt56TerraProfile } from "../codex-gpt-5-6-terra.js";
import { grokXaiGrok45Profile } from "../grok-4-5.js";
import { grokXaiGrokBuildProfile } from "../grok-build.js";
import { grokXaiGrokComposer25FastProfile } from "../grok-composer-2-5-fast.js";
import { kimiMoonshotK3Profile } from "../kimi-k3.js";
import { bedrockZaiGlm47FlashProfile } from "../zai-glm-4-7-flash.js";
import { bedrockZaiGlm5Profile } from "../zai-glm-5.js";
import {
    bedrockAnthropicFable5Profile,
    bedrockAnthropicOpus48Profile,
    bedrockAnthropicSonnet5Profile,
    bedrockOpenaiGpt56LunaProfile,
    bedrockOpenaiGpt56SolProfile,
    bedrockOpenaiGpt56TerraProfile,
} from "./bedrockModelProfileVariants.js";
import type { ModelProfile } from "./types.js";

export const modelProfiles: readonly ModelProfile[] = [
    // Claude
    claudeAnthropicFable5Profile,
    bedrockAnthropicFable5Profile,
    claudeAnthropicOpus48Profile,
    bedrockAnthropicOpus48Profile,
    claudeAnthropicSonnet5Profile,
    bedrockAnthropicSonnet5Profile,

    // Codex
    codexOpenaiGpt56LunaProfile,
    bedrockOpenaiGpt56LunaProfile,
    codexOpenaiGpt56SolProfile,
    bedrockOpenaiGpt56SolProfile,
    codexOpenaiGpt56TerraProfile,
    bedrockOpenaiGpt56TerraProfile,

    // Grok
    grokXaiGrok45Profile,
    grokXaiGrokBuildProfile,
    grokXaiGrokComposer25FastProfile,

    // Kimi
    kimiMoonshotK3Profile,

    // Z.ai
    bedrockZaiGlm47FlashProfile,
    bedrockZaiGlm5Profile,
];
