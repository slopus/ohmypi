import { BaseCredential } from "@/core/BaseCredential.js";
import {
    GROK_API_KEY_SCOPE,
    getGrokAuthPath,
    readGrokAuthStore,
} from "@/vendors/grok/impl/auth.js";

export type GrokApiKeyCredentialValue = {
    readonly source: "api-key";
    readonly token: string;
};

export interface GrokApiKeyCredentialLoadOptions {
    apiKey?: string;
    authFile?: string;
    env?: NodeJS.ProcessEnv;
}

export class GrokApiKeyCredential extends BaseCredential<
    "grok-api-key",
    GrokApiKeyCredentialValue
> {
    static async tryLoad(
        options: GrokApiKeyCredentialLoadOptions = {},
    ): Promise<GrokApiKeyCredential | null> {
        const env = options.env ?? process.env;
        const explicitApiKey = options.apiKey?.trim();
        if (explicitApiKey) {
            return new GrokApiKeyCredential({ source: "api-key", token: explicitApiKey });
        }

        const environmentApiKey = env.XAI_API_KEY?.trim();
        if (environmentApiKey) {
            return new GrokApiKeyCredential({ source: "api-key", token: environmentApiKey });
        }

        const authPath = getGrokAuthPath({
            ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
            env,
        });
        const store = await readGrokAuthStore(authPath);
        const apiKeyRecord = store[GROK_API_KEY_SCOPE];
        if (typeof apiKeyRecord?.key === "string" && apiKeyRecord.key.trim().length > 0) {
            return new GrokApiKeyCredential({ source: "api-key", token: apiKeyRecord.key });
        }

        return null;
    }

    private constructor(credential: GrokApiKeyCredentialValue) {
        super("grok-api-key", credential);
    }
}
