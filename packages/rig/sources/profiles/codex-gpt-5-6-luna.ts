// codex model profile; transport-specific overrides live under ./impl.
// Differences from Codex 0.144.3: Rig concatenates runtime sections into one system prompt
// and uses direct function tools, while the official client uses Responses Lite developer
// items and code-mode tools. Rig also exposes off reasoning beyond the official catalog.
import { createModelProfile } from "./impl/createModelProfile.js";
import { codexReferenceClient } from "./impl/codexReferenceClient.js";
import { gpt56LunaPrompt } from "./codex/prompt.js";
import { codexProfileTools } from "./impl/profileTools.js";
import { modelOpenaiGpt56Luna } from "../providers/models.js";

export const codexOpenaiGpt56LunaProfile = createModelProfile({
    providerType: "codex",
    vendor: "openai",
    model: modelOpenaiGpt56Luna,
    imageProfile: "codex",
    toolProfile: "codex",
    tools: codexProfileTools,
    prompt: gpt56LunaPrompt,
    wireMode: "openai-responses",
    wireModelId: "gpt-5.6-luna",
    referenceClient: codexReferenceClient("openai/gpt-5.6-luna"),
    serviceTiers: ["fast"],
});
