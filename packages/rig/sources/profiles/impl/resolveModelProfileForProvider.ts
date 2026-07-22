import type { Model, Provider, ProviderToolProfile } from "../../providers/types.js";
import { resolveModelProfile } from "./resolveModelProfile.js";
import type { ModelProfile, ProfileProviderType } from "./types.js";

const profileTypeByToolProfile: Partial<Record<ProviderToolProfile, ProfileProviderType>> = {
    claude: "claude",
    codex: "codex",
    grok: "grok",
    kimi: "kimi",
};

export function resolveModelProfileForProvider(
    provider: Provider,
    model: Model,
): ModelProfile | undefined {
    const exact = resolveModelProfile(provider.profileType, model.id);
    if (provider.profileType !== undefined) return exact;
    const fallbackType = profileTypeByToolProfile[provider.toolProfile(model)];
    return fallbackType === undefined ? undefined : resolveModelProfile(fallbackType, model.id);
}
