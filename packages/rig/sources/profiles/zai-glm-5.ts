// zai model profile; transport-specific overrides live under ./impl.
// Difference from the official client: no versioned Z.ai coding-client prompt was captured;
// Rig supplies its runtime append and compact Pi tool surface over Amazon Bedrock.
import { createModelProfile } from "./impl/createModelProfile.js";
import { noCapturedPrompt } from "./impl/noCapturedPrompt.js";
import { piProfileTools } from "./impl/profileTools.js";
import { modelZaiGlm5 } from "../providers/models.js";

export const bedrockZaiGlm5Profile = createModelProfile({
    providerType: "bedrock",
    vendor: "zai",
    model: modelZaiGlm5,
    imageProfile: "codex",
    toolProfile: "pi",
    tools: piProfileTools,
    prompt: noCapturedPrompt,
    wireMode: "bedrock-mantle-or-runtime",
});
