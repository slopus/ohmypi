import { BaseProvider } from "@/core/BaseProvider.js";
import type { ProviderModality } from "@/core/ProviderModality.js";
import type { SessionOptions } from "@/core/SessionOptions.js";
import type { BedrockCredential } from "@/vendors/VendorCredential.js";
import {
    AnthropicBedrockSession,
    type AnthropicBedrockClient,
} from "@/vendors/bedrock/AnthropicBedrockSession.js";
import type { AnthropicBedrockTransport } from "@/vendors/bedrock/AnthropicBedrockTransport.js";
import { assertBedrockCredential } from "@/vendors/bedrock/impl/assertBedrockCredential.js";
import { BEDROCK_DEFAULT_REGION } from "@/vendors/bedrock/impl/bedrockConstants.js";

export interface AnthropicBedrockProviderOptions {
    credential: BedrockCredential;
    client?: AnthropicBedrockClient;
    endpoint?: string;
    model?: string;
    region?: string;
    transport?: AnthropicBedrockTransport;
}

export class AnthropicBedrockProvider extends BaseProvider {
    static override readonly name = "anthropic-bedrock";
    static override readonly inputTypes: readonly ProviderModality[] = ["text", "image"];
    static override readonly outputTypes: readonly ProviderModality[] = ["text"];

    readonly credential: BedrockCredential;
    readonly client: AnthropicBedrockClient | undefined;
    readonly endpoint: string | undefined;
    readonly model: string | undefined;
    readonly region: string;
    readonly transport: AnthropicBedrockTransport;

    constructor(options: AnthropicBedrockProviderOptions) {
        super();
        assertBedrockCredential(options.credential);
        this.credential = options.credential;
        this.client = options.client;
        this.endpoint = options.endpoint;
        this.model = options.model;
        this.region = options.region?.trim() || BEDROCK_DEFAULT_REGION;
        this.transport = options.transport ?? "mantle";
    }

    override async session(id: string, options: SessionOptions): Promise<AnthropicBedrockSession> {
        return new AnthropicBedrockSession(id, {
            ...options,
            credential: this.credential,
            ...(this.client === undefined ? {} : { client: this.client }),
            ...(this.endpoint === undefined ? {} : { endpoint: this.endpoint }),
            ...(this.model === undefined ? {} : { model: this.model }),
            region: this.region,
            transport: this.transport,
        });
    }
}
