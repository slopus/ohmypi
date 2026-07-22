// kimi model profile; transport-specific overrides live under ./impl.
// Differences from the official client: the prompt is Rig-authored from an unpinned source
// rather than a byte-identical capture, and its Claude-shaped tools run through AgentContext.
import { createModelProfile } from "./impl/createModelProfile.js";
import { kimiPrompt } from "./kimi/prompt.js";
import { kimiProfileTools } from "./impl/profileTools.js";
import { modelMoonshotKimiK3 } from "../providers/models.js";

export const kimiMoonshotK3Profile = createModelProfile({
    providerType: "kimi",
    vendor: "moonshot",
    model: modelMoonshotKimiK3,
    imageProfile: "codex",
    toolProfile: "kimi",
    tools: kimiProfileTools,
    prompt: kimiPrompt,
    wireMode: "kimi-chat-completions",
    wireModelId: "k3",
    maxOutputTokens: 131_072,
});
