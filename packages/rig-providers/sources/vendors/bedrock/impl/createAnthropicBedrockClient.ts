import { AnthropicBedrock, AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

import type { AnthropicBedrockTransport } from "@/vendors/bedrock/AnthropicBedrockTransport.js";

export type AnthropicBedrockClient = Pick<AnthropicBedrock | AnthropicBedrockMantle, "beta">;

export function createAnthropicBedrockClient(options: {
    bearerToken: string;
    endpoint?: string;
    region: string;
    transport: AnthropicBedrockTransport;
}): AnthropicBedrockClient {
    const clientOptions = {
        apiKey: options.bearerToken,
        awsRegion: options.region,
        maxRetries: 0,
        ...(options.endpoint === undefined ? {} : { baseURL: options.endpoint }),
    };
    return options.transport === "mantle"
        ? new AnthropicBedrockMantle(clientOptions)
        : new AnthropicBedrock(clientOptions);
}
