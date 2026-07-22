import { defineModelProfile } from "./defineModelProfile.js";
import type { Model, ServiceTier } from "../../providers/types.js";
import type { ModelProfile, ProfilePrompt, ProfileProviderType, ProfileWireMode } from "./types.js";

export function createModelProfileVariant(
    base: ModelProfile,
    options: {
        model?: Model;
        profileType: ProfileProviderType;
        prompt?: ProfilePrompt;
        referenceClient?: ModelProfile["parameters"]["referenceClient"] | null;
        serviceTiers?: readonly ServiceTier[];
        wireMode: ProfileWireMode;
    },
): ModelProfile {
    const model = options.model ?? base.model;
    const {
        referenceClient: baseReferenceClient,
        wireModelId: _wireModelId,
        ...baseParameters
    } = base.parameters;
    const referenceClient =
        options.referenceClient === null
            ? undefined
            : (options.referenceClient ?? baseReferenceClient);
    return defineModelProfile({
        ...base,
        id: `${options.profileType}:${model.id}`,
        providerType: options.profileType,
        model,
        prompt: options.prompt ?? base.prompt,
        parameters: {
            ...baseParameters,
            wireMode: options.wireMode,
            serviceTiers: options.serviceTiers ?? [],
            ...(referenceClient === undefined ? {} : { referenceClient }),
            ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
            ...(model.autoCompactWindow === undefined
                ? {}
                : { autoCompactWindow: model.autoCompactWindow }),
            thinkingLevels: model.thinkingLevels,
            defaultThinkingLevel: model.defaultThinkingLevel,
        },
    });
}
