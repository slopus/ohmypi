import { defineModelProfile } from "./defineModelProfile.js";
import type {
    ModelProfile,
    ModelVendor,
    ProfilePrompt,
    ProfileProviderType,
    ProfileWireMode,
} from "./types.js";
import type { AnyDefinedTool } from "../../agent/types.js";
import type {
    Model,
    ProviderImageProfile,
    ProviderToolProfile,
    ServiceTier,
} from "../../providers/types.js";

export function createModelProfile(options: {
    providerType: ProfileProviderType;
    vendor: ModelVendor;
    model: Model;
    imageProfile: ProviderImageProfile;
    toolProfile: ProviderToolProfile;
    tools: { base: readonly AnyDefinedTool[]; collaboration: readonly AnyDefinedTool[] };
    prompt: ProfilePrompt;
    wireMode: ProfileWireMode;
    wireModelId?: string;
    maxOutputTokens?: number;
    referenceClient?: ModelProfile["parameters"]["referenceClient"];
    serviceTiers?: readonly ServiceTier[];
}): ModelProfile {
    return defineModelProfile({
        id: `${options.providerType}:${options.model.id}`,
        providerType: options.providerType,
        vendor: options.vendor,
        model: options.model,
        imageProfile: options.imageProfile,
        toolProfile: options.toolProfile,
        tools: options.tools,
        prompt: options.prompt,
        parameters: {
            wireMode: options.wireMode,
            ...(options.wireModelId === undefined ? {} : { wireModelId: options.wireModelId }),
            ...(options.maxOutputTokens === undefined
                ? {}
                : { maxOutputTokens: options.maxOutputTokens }),
            serviceTiers: options.serviceTiers ?? [],
            ...(options.model.contextWindow === undefined
                ? {}
                : { contextWindow: options.model.contextWindow }),
            ...(options.model.autoCompactWindow === undefined
                ? {}
                : { autoCompactWindow: options.model.autoCompactWindow }),
            thinkingLevels: options.model.thinkingLevels,
            defaultThinkingLevel: options.model.defaultThinkingLevel,
            ...(options.referenceClient === undefined
                ? {}
                : { referenceClient: options.referenceClient }),
        },
    });
}
