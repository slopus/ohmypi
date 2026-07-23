import { BaseCredential } from "@/core/BaseCredential.js";
import { readClaudeCodeOAuthToken } from "@/vendors/claude/impl/auth.js";

export type ClaudeOAuthCredentialValue = {
    readonly accessToken: string;
};

export interface ClaudeOAuthCredentialLoadOptions {
    configDir?: string;
    env?: NodeJS.ProcessEnv;
    oauthToken?: string;
}

export class ClaudeOAuthCredential extends BaseCredential<
    "claude-oauth",
    ClaudeOAuthCredentialValue
> {
    static async tryLoad(
        options: ClaudeOAuthCredentialLoadOptions = {},
    ): Promise<ClaudeOAuthCredential | null> {
        const explicitOAuthToken = options.oauthToken?.trim();
        if (explicitOAuthToken) {
            return new ClaudeOAuthCredential({ accessToken: explicitOAuthToken });
        }

        const env = {
            ...(options.env ?? process.env),
            ...(options.configDir === undefined ? {} : { CLAUDE_CONFIG_DIR: options.configDir }),
        };
        const accessToken = await readClaudeCodeOAuthToken({ env });
        if (accessToken === undefined) {
            return null;
        }

        return new ClaudeOAuthCredential({ accessToken });
    }

    private constructor(credential: ClaudeOAuthCredentialValue) {
        super("claude-oauth", credential);
    }
}
