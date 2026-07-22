import { modelProfiles } from "./modelProfiles.js";
import type { ProfileProviderType } from "./types.js";
import type { Model } from "../../providers/types.js";

const modelOrderByProviderType: Record<ProfileProviderType, readonly string[]> = {
    bedrock: [
        "anthropic/sonnet-5",
        "anthropic/fable-5",
        "anthropic/opus-4-8",
        "zai/glm-5",
        "zai/glm-4.7-flash",
        "openai/gpt-5.6-sol",
        "openai/gpt-5.6-terra",
        "openai/gpt-5.6-luna",
    ],
    claude: ["anthropic/fable-5", "anthropic/opus-4-8", "anthropic/sonnet-5"],
    codex: ["openai/gpt-5.6-sol", "openai/gpt-5.6-terra", "openai/gpt-5.6-luna"],
    grok: ["xai/grok-build", "xai/grok-4.5", "xai/grok-composer-2.5-fast"],
    kimi: ["moonshot/kimi-k3"],
};

export function modelsForProfileProviderType(providerType: ProfileProviderType): readonly Model[] {
    const order = modelOrderByProviderType[providerType];
    return modelProfiles
        .filter((profile) => profile.providerType === providerType)
        .toSorted((left, right) => order.indexOf(left.model.id) - order.indexOf(right.model.id))
        .map((profile) => profile.model);
}
