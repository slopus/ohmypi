import {
    anthropicBedrockMantleEndpoint,
    bedrockMantleEndpoint,
    bedrockRuntimeEndpoint,
} from "@slopus/rig-providers";

import type { BedrockModelOverride } from "./bedrock-model-overrides.js";
import type { BedrockModelRoute, BedrockModelTransport } from "./bedrock-model-routes.js";

export function resolveBedrockModelEndpoint(
    route: BedrockModelRoute,
    region: string,
    transport: BedrockModelTransport,
    override: BedrockModelOverride | undefined,
): string {
    const endpoint = override?.endpoint?.trim();
    if (endpoint) return endpoint;
    if (transport === "runtime") return bedrockRuntimeEndpoint(region);
    return route.provider === "anthropic"
        ? anthropicBedrockMantleEndpoint(region)
        : bedrockMantleEndpoint(region);
}
