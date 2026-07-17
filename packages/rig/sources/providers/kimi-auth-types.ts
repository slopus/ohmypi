export interface KimiAuthRecord {
    access_token: string;
    expires_at: number;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
}

export interface KimiCredential {
    source: "api-key" | "session";
    token: string;
}

export interface ResolveKimiCredentialOptions {
    apiKey?: string;
    authFile?: string;
    env?: NodeJS.ProcessEnv;
    fetch?: typeof globalThis.fetch;
    force?: boolean;
    now?: () => number;
}
