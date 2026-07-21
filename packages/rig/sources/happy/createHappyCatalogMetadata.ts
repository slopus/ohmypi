import type { ModelCatalog } from "../protocol/index.js";
import { describeHappyProvider } from "./describeHappyProvider.js";
import type { HappyProviderDescriptor, HappyPublishedModel } from "./types.js";

export function createHappyCatalogMetadata(modelCatalog: ModelCatalog): {
    models: HappyPublishedModel[];
    providers: HappyProviderDescriptor[];
} {
    return {
        models: modelCatalog.providers.flatMap((providerCatalog) =>
            providerCatalog.models.map((model) => {
                const provider = describeHappyProvider(providerCatalog.providerId);
                return {
                    code: model.id,
                    ...(model.contextWindow === undefined
                        ? {}
                        : { contextWindow: model.contextWindow }),
                    defaultThinkingLevel: model.defaultThinkingLevel,
                    id: model.id,
                    name: model.name,
                    provider,
                    providerId: providerCatalog.providerId,
                    providerKind: provider.kind,
                    providerName: provider.name,
                    serviceTiers: [...(providerCatalog.serviceTiers ?? [])],
                    thinkingLevels: [...model.thinkingLevels],
                    value: model.name,
                };
            }),
        ),
        providers: modelCatalog.providers.map((provider) =>
            describeHappyProvider(provider.providerId),
        ),
    };
}
