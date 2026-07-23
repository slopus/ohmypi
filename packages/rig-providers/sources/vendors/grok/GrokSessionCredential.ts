import { BaseCredential } from "@/core/BaseCredential.js";
import { GROK_OAUTH_SCOPE, getGrokAuthPath, readGrokAuthStore } from "@/vendors/grok/impl/auth.js";

export type GrokSessionCredentialValue = {
    readonly source: "session";
    readonly token: string;
};

export interface GrokSessionCredentialLoadOptions {
    authFile?: string;
    env?: NodeJS.ProcessEnv;
}

export class GrokSessionCredential extends BaseCredential<
    "grok-session",
    GrokSessionCredentialValue
> {
    static async tryLoad(
        options: GrokSessionCredentialLoadOptions = {},
    ): Promise<GrokSessionCredential | null> {
        const env = options.env ?? process.env;
        const authPath = getGrokAuthPath({
            ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
            env,
        });
        const store = await readGrokAuthStore(authPath);
        const session = store[GROK_OAUTH_SCOPE];
        if (typeof session?.key !== "string" || session.key.trim().length === 0) {
            return null;
        }

        return new GrokSessionCredential({ source: "session", token: session.key });
    }

    private constructor(credential: GrokSessionCredentialValue) {
        super("grok-session", credential);
    }
}
