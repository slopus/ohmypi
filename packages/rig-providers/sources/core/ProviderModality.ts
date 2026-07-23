export const PROVIDER_MODALITIES = ["text", "image", "audio", "video"] as const;

export type ProviderModality = (typeof PROVIDER_MODALITIES)[number];
