import { BaseCredential } from "@/core/BaseCredential.js";
import { getCodexAuthPath, readCodexQuotaAuthFile } from "@/vendors/codex/impl/auth.js";

export type CodexSessionCredentialValue = {
    readonly accessToken: string;
    readonly accountId?: string;
};

export interface CodexSessionCredentialLoadOptions {
    authFile?: string;
    env?: NodeJS.ProcessEnv;
}

export class CodexSessionCredential extends BaseCredential<
    "codex-session",
    CodexSessionCredentialValue
> {
    static async tryLoad(
        options: CodexSessionCredentialLoadOptions = {},
    ): Promise<CodexSessionCredential | null> {
        const authPath = getCodexAuthPath({
            ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
            ...(options.env === undefined ? {} : { env: options.env }),
        });
        const auth = await readCodexQuotaAuthFile(authPath);
        if (auth === undefined) {
            return null;
        }

        return new CodexSessionCredential({
            accessToken: auth.accessToken,
            ...(auth.accountId === undefined ? {} : { accountId: auth.accountId }),
        });
    }

    private constructor(credential: CodexSessionCredentialValue) {
        super("codex-session", credential);
    }
}
