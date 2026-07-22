// codex model profile; transport-specific overrides live under ./impl.
// Differences from Codex 0.144.3: Rig concatenates runtime sections into one system prompt
// and uses direct function tools, while the official client uses Responses Lite developer
// items and code-mode tools. Rig exposes off reasoning and implements Ultra as max reasoning
// plus a Rig-owned prompt append.
import { createModelProfile } from "./impl/createModelProfile.js";
import { codexReferenceClient } from "./impl/codexReferenceClient.js";
import { gpt56SolPromptWithUltra } from "./codex/prompt.js";
import { codexProfileTools } from "./impl/profileTools.js";
import { modelOpenaiGpt56Sol } from "../providers/models.js";

export const codexOpenaiGpt56SolProfile = createModelProfile({
    providerType: "codex",
    vendor: "openai",
    model: modelOpenaiGpt56Sol,
    imageProfile: "codex",
    toolProfile: "codex",
    tools: codexProfileTools,
    prompt: gpt56SolPromptWithUltra,
    wireMode: "openai-responses",
    wireModelId: "gpt-5.6-sol",
    referenceClient: codexReferenceClient("openai/gpt-5.6-sol"),
    serviceTiers: ["fast"],
});
