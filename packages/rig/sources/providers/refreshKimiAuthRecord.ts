import type { KimiAuthRecord } from "./kimi-auth-types.js";
import { KIMI_DEFAULT_OAUTH_HOST, KIMI_OAUTH_CLIENT_ID } from "./kimi-constants.js";

export async function refreshKimiAuthRecord(options: {
    env?: NodeJS.ProcessEnv;
    fetch: typeof globalThis.fetch;
    headers: Record<string, string>;
    now: number;
    record: KimiAuthRecord;
}): Promise<KimiAuthRecord> {
    if (options.record.refresh_token.length === 0) {
        throw new Error("The Kimi Code session cannot be refreshed. Run `kimi login` again.");
    }
    const oauthHost =
        options.env?.KIMI_CODE_OAUTH_HOST?.trim() ||
        options.env?.KIMI_OAUTH_HOST?.trim() ||
        KIMI_DEFAULT_OAUTH_HOST;
    const response = await options.fetch(`${oauthHost.replace(/\/$/u, "")}/api/oauth/token`, {
        body: new URLSearchParams({
            client_id: KIMI_OAUTH_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: options.record.refresh_token,
        }),
        headers: {
            ...options.headers,
            "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
        signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
        throw new Error("Kimi Code rejected the saved session. Run `kimi login` again.");
    }
    if (!response.ok) {
        throw new Error(`Kimi Code sign-in refresh failed (${response.status}).`);
    }
    const value = (await response.json()) as Record<string, unknown>;
    const accessToken = value.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new Error("Kimi Code sign-in refresh did not return an access token.");
    }
    const expiresIn =
        typeof value.expires_in === "number" ? value.expires_in : options.record.expires_in;
    return {
        access_token: accessToken,
        refresh_token:
            typeof value.refresh_token === "string"
                ? value.refresh_token
                : options.record.refresh_token,
        expires_at: expiresIn > 0 ? options.now + expiresIn : 0,
        expires_in: expiresIn,
        scope: typeof value.scope === "string" ? value.scope : options.record.scope,
        token_type:
            typeof value.token_type === "string" ? value.token_type : options.record.token_type,
    };
}
