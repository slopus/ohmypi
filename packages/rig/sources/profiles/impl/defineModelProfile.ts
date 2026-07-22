import type { ModelProfile } from "./types.js";

export function defineModelProfile(profile: ModelProfile): ModelProfile {
    const expectedId = `${profile.providerType}:${profile.model.id}`;
    if (profile.id !== expectedId) {
        throw new Error(`Profile id '${profile.id}' must be '${expectedId}'.`);
    }
    if (!profile.model.id.startsWith(`${profile.vendor}/`)) {
        throw new Error(
            `Profile '${profile.id}' vendor '${profile.vendor}' does not match model '${profile.model.id}'.`,
        );
    }
    return profile;
}
