import { BaseCredential } from "@/core/BaseCredential.js";
import { readGeminiApiKey } from "@/vendors/gemini/impl/auth.js";

export type GeminiApiKeyCredentialValue = {
    readonly apiKey: string;
};

export interface GeminiApiKeyCredentialLoadOptions {
    apiKey?: string;
    env?: NodeJS.ProcessEnv;
}

export class GeminiApiKeyCredential extends BaseCredential<
    "gemini-api-key",
    GeminiApiKeyCredentialValue
> {
    static async tryLoad(
        options: GeminiApiKeyCredentialLoadOptions = {},
    ): Promise<GeminiApiKeyCredential | null> {
        const apiKey = options.apiKey?.trim() ?? readGeminiApiKey(options.env);
        if (!apiKey) {
            return null;
        }

        return new GeminiApiKeyCredential({ apiKey });
    }

    private constructor(credential: GeminiApiKeyCredentialValue) {
        super("gemini-api-key", credential);
    }
}
