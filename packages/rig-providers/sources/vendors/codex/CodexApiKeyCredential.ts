import { BaseCredential } from "@/core/BaseCredential.js";

export type CodexApiKeyCredentialValue = {
    readonly apiKey: string;
};

export interface CodexApiKeyCredentialLoadOptions {
    apiKey?: string;
}

export class CodexApiKeyCredential extends BaseCredential<
    "codex-api-key",
    CodexApiKeyCredentialValue
> {
    static async tryLoad(
        options: CodexApiKeyCredentialLoadOptions = {},
    ): Promise<CodexApiKeyCredential | null> {
        const apiKey = options.apiKey?.trim();
        if (!apiKey) {
            return null;
        }

        return new CodexApiKeyCredential({ apiKey });
    }

    private constructor(credential: CodexApiKeyCredentialValue) {
        super("codex-api-key", credential);
    }
}
