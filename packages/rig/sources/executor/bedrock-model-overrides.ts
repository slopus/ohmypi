import type { BedrockModelTransport } from "./bedrock-model-routes.js";

export interface BedrockModelOverride {
    endpoint?: string;
    region?: string;
    transport?: BedrockModelTransport;
}

export type BedrockModelOverrides = Readonly<Record<string, BedrockModelOverride>>;
