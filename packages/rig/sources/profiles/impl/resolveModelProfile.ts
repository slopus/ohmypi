import { modelProfiles } from "./modelProfiles.js";
import type { ModelProfile, ProfileProviderType } from "./types.js";

const profileById = new Map(modelProfiles.map((profile) => [profile.id, profile]));

export function resolveModelProfile(
    providerType: ProfileProviderType | undefined,
    modelId: string,
): ModelProfile | undefined {
    if (providerType === undefined) return undefined;
    return profileById.get(`${providerType}:${modelId}`);
}
