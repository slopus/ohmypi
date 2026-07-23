import { BaseCredential } from "@/core/BaseCredential.js";
import { readBedrockBearerToken } from "@/vendors/bedrock/impl/auth.js";

export type BedrockBearerTokenCredentialValue = {
    readonly bearerToken: string;
};

export interface BedrockBearerTokenCredentialLoadOptions {
    bearerToken?: string;
    bearerTokenEnvVar?: string;
    env?: NodeJS.ProcessEnv;
}

export class BedrockBearerTokenCredential extends BaseCredential<
    "bedrock-bearer-token",
    BedrockBearerTokenCredentialValue
> {
    static async tryLoad(
        options: BedrockBearerTokenCredentialLoadOptions = {},
    ): Promise<BedrockBearerTokenCredential | null> {
        const explicitBearerToken = options.bearerToken?.trim();
        if (explicitBearerToken) {
            return new BedrockBearerTokenCredential({ bearerToken: explicitBearerToken });
        }

        const env = options.env ?? process.env;
        const bearerToken = readBedrockBearerToken(env, options.bearerTokenEnvVar);
        if (bearerToken === undefined) {
            return null;
        }

        return new BedrockBearerTokenCredential({ bearerToken });
    }

    private constructor(credential: BedrockBearerTokenCredentialValue) {
        super("bedrock-bearer-token", credential);
    }
}
