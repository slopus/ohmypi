// grok model profile; transport-specific overrides live under ./impl.
// Differences from the official client: the prompt is a Rig adaptation from an unpinned
// upstream snapshot, and tools run through Rig's shared permissions and sandbox.
import { createModelProfile } from "./impl/createModelProfile.js";
import { grokPrompt } from "./grok/prompt.js";
import { grokProfileTools } from "./impl/profileTools.js";
import { modelXaiGrokBuild } from "../providers/models.js";

export const grokXaiGrokBuildProfile = createModelProfile({
    providerType: "grok",
    vendor: "xai",
    model: modelXaiGrokBuild,
    imageProfile: "codex",
    toolProfile: "grok",
    tools: grokProfileTools,
    prompt: grokPrompt,
    wireMode: "grok-openai-responses",
    wireModelId: "grok-build",
});
