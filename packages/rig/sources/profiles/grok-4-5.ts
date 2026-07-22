// grok model profile; transport-specific overrides live under ./impl.
// Differences from the official client: Rig reuses an adapted, unpinned Grok Build prompt
// and tool surface for this non-Build model; tools use Rig's shared permissions and sandbox.
import { createModelProfile } from "./impl/createModelProfile.js";
import { grokPrompt } from "./grok/prompt.js";
import { grokProfileTools } from "./impl/profileTools.js";
import { modelXaiGrok45 } from "../providers/models.js";

export const grokXaiGrok45Profile = createModelProfile({
    providerType: "grok",
    vendor: "xai",
    model: modelXaiGrok45,
    imageProfile: "codex",
    toolProfile: "grok",
    tools: grokProfileTools,
    prompt: grokPrompt,
    wireMode: "grok-openai-responses",
    wireModelId: "grok-4.5",
});
