import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export function getCodexAuthPath(options: { authFile?: string; env?: NodeJS.ProcessEnv } = {}): string {
    if (options.authFile?.trim()) return options.authFile;

    const codexHome = (options.env ?? process.env).CODEX_HOME?.trim();
    return join(codexHome || homedir(), codexHome ? "auth.json" : ".codex/auth.json");
}

export interface CodexQuotaAuth {
    accessToken: string;
    accountId?: string;
}

export function readCodexQuotaAuth(contents: string): CodexQuotaAuth | undefined {
    const parsed = JSON.parse(contents) as {
        tokens?: {
            access_token?: unknown;
            account_id?: unknown;
            id_token?: unknown;
        };
    };
    const accessToken = parsed.tokens?.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
        return undefined;
    }

    const storedAccountId = parsed.tokens?.account_id;
    if (typeof storedAccountId === "string" && storedAccountId.length > 0) {
        return { accessToken, accountId: storedAccountId };
    }

    for (const token of [parsed.tokens?.id_token, accessToken]) {
        if (typeof token !== "string") {
            continue;
        }
        try {
            const payload = token.split(".")[1];
            if (payload === undefined) {
                continue;
            }
            const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
                "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown };
            };
            const accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
            if (typeof accountId === "string" && accountId.length > 0) {
                return { accessToken, accountId };
            }
        } catch {
            // A bearer token need not be a JWT, so an undecodable token is still usable.
        }
    }

    return { accessToken };
}

export async function readCodexQuotaAuthFile(path: string): Promise<CodexQuotaAuth | undefined> {
    try {
        return readCodexQuotaAuth(await readFile(path, "utf8"));
    } catch (error) {
        if (isFileNotFound(error)) {
            return undefined;
        }
        throw error;
    }
}

function isFileNotFound(error: unknown): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}
