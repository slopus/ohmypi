import { BaseCredential } from "@/core/BaseCredential.js";

export type ClaudeApiKeyCredentialValue = {
    readonly apiKey: string;
};

export interface ClaudeApiKeyCredentialLoadOptions {
    apiKey?: string;
    env?: NodeJS.ProcessEnv;
}

export class ClaudeApiKeyCredential extends BaseCredential<
    "claude-api-key",
    ClaudeApiKeyCredentialValue
> {
    static async tryLoad(
        options: ClaudeApiKeyCredentialLoadOptions = {},
    ): Promise<ClaudeApiKeyCredential | null> {
        const apiKey = options.apiKey?.trim() ?? options.env?.ANTHROPIC_API_KEY?.trim();
        if (!apiKey) {
            return null;
        }

        return new ClaudeApiKeyCredential({ apiKey });
    }

    private constructor(credential: ClaudeApiKeyCredentialValue) {
        super("claude-api-key", credential);
    }
}
