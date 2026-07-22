// grok model profile; transport-specific overrides live under ./impl.
// Differences from the official client: Rig reuses an adapted, unpinned Grok Build prompt
// and tool surface for this non-Build model; tools use Rig's shared permissions and sandbox.
import { createModelProfile } from "./impl/createModelProfile.js";
import { grokPrompt } from "./grok/prompt.js";
import { grokProfileTools } from "./impl/profileTools.js";
import { modelXaiGrokComposer25Fast } from "../providers/models.js";

export const grokXaiGrokComposer25FastProfile = createModelProfile({
    providerType: "grok",
    vendor: "xai",
    model: modelXaiGrokComposer25Fast,
    imageProfile: "codex",
    toolProfile: "grok",
    tools: grokProfileTools,
    prompt: grokPrompt,
    wireMode: "grok-openai-responses",
    wireModelId: "grok-composer-2.5-fast",
});
