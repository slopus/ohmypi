import { BaseCredential } from "@/core/BaseCredential.js";

export type ClaudeAuthTokenCredentialValue = {
    readonly authToken: string;
};

export interface ClaudeAuthTokenCredentialLoadOptions {
    authToken?: string;
    env?: NodeJS.ProcessEnv;
}

export class ClaudeAuthTokenCredential extends BaseCredential<
    "claude-auth-token",
    ClaudeAuthTokenCredentialValue
> {
    static async tryLoad(
        options: ClaudeAuthTokenCredentialLoadOptions = {},
    ): Promise<ClaudeAuthTokenCredential | null> {
        const authToken = options.authToken?.trim() ?? options.env?.ANTHROPIC_AUTH_TOKEN?.trim();
        if (!authToken) {
            return null;
        }

        return new ClaudeAuthTokenCredential({ authToken });
    }

    private constructor(credential: ClaudeAuthTokenCredentialValue) {
        super("claude-auth-token", credential);
    }
}
