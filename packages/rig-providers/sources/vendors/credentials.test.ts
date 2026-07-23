import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { BedrockBearerTokenCredential } from "@/vendors/bedrock/BedrockBearerTokenCredential.js";
import { ClaudeApiKeyCredential } from "@/vendors/claude/ClaudeApiKeyCredential.js";
import { ClaudeAuthTokenCredential } from "@/vendors/claude/ClaudeAuthTokenCredential.js";
import { ClaudeOAuthCredential } from "@/vendors/claude/ClaudeOAuthCredential.js";
import { CodexApiKeyCredential } from "@/vendors/codex/CodexApiKeyCredential.js";
import { CodexSessionCredential } from "@/vendors/codex/CodexSessionCredential.js";
import { GROK_API_KEY_SCOPE, GROK_OAUTH_SCOPE } from "@/vendors/grok/impl/auth.js";
import { GeminiApiKeyCredential } from "@/vendors/gemini/GeminiApiKeyCredential.js";
import { GrokApiKeyCredential } from "@/vendors/grok/GrokApiKeyCredential.js";
import { GrokSessionCredential } from "@/vendors/grok/GrokSessionCredential.js";

const tempDirs: string[] = [];

afterEach(async () => {
    tempDirs.length = 0;
});

describe("vendor credentials", () => {
    it("loads grok api key credentials from explicit, env, and auth file sources", async () => {
        const explicit = await GrokApiKeyCredential.tryLoad({ apiKey: "explicit-key", env: {} });
        expect(explicit).toMatchObject({
            name: "grok-api-key",
            credential: { source: "api-key", token: "explicit-key" },
        });

        const fromEnv = await GrokApiKeyCredential.tryLoad({
            env: { XAI_API_KEY: "environment-key" },
        });
        expect(fromEnv?.credential.token).toBe("environment-key");

        const authFile = await writeAuthFile({
            [GROK_API_KEY_SCOPE]: {
                auth_mode: "api_key",
                key: "stored-key",
            },
        });
        const fromAuthFile = await GrokApiKeyCredential.tryLoad({ authFile, env: {} });
        expect(fromAuthFile?.credential.token).toBe("stored-key");

        expect(await GrokApiKeyCredential.tryLoad({ env: {} })).toBeNull();
    });

    it("loads grok session credentials when a stored session exists", async () => {
        const authFile = await writeAuthFile({
            [GROK_OAUTH_SCOPE]: {
                auth_mode: "oidc",
                create_time: "2026-07-15T12:00:00.000Z",
                expires_at: "2026-07-15T13:00:00.000Z",
                key: "session-token",
            },
        });

        expect(
            await GrokSessionCredential.tryLoad({
                authFile,
                env: {},
            }),
        ).toMatchObject({
            name: "grok-session",
            credential: { source: "session", token: "session-token" },
        });
    });

    it("still loads expired grok session credentials when the auth record is present", async () => {
        const authFile = await writeAuthFile({
            [GROK_OAUTH_SCOPE]: {
                auth_mode: "oidc",
                create_time: "2026-07-15T12:00:00.000Z",
                expires_at: "2026-07-15T13:00:00.000Z",
                key: "session-token",
            },
        });

        expect(
            await GrokSessionCredential.tryLoad({
                authFile,
                env: {},
            }),
        ).toMatchObject({
            name: "grok-session",
            credential: { source: "session", token: "session-token" },
        });
    });

    it("loads codex credentials", async () => {
        expect(await CodexApiKeyCredential.tryLoad({ apiKey: "codex-key" })).toMatchObject({
            name: "codex-api-key",
            credential: { apiKey: "codex-key" },
        });
        expect(await CodexApiKeyCredential.tryLoad({})).toBeNull();

        const authFile = await writeAuthFile({
            tokens: {
                access_token: "access-token",
                account_id: "acct_123",
            },
        });
        expect(await CodexSessionCredential.tryLoad({ authFile, env: {} })).toMatchObject({
            name: "codex-session",
            credential: { accessToken: "access-token", accountId: "acct_123" },
        });
    });

    it("loads bedrock bearer token credentials", async () => {
        expect(
            await BedrockBearerTokenCredential.tryLoad({ bearerToken: "explicit-token", env: {} }),
        ).toMatchObject({
            name: "bedrock-bearer-token",
            credential: { bearerToken: "explicit-token" },
        });

        expect(
            await BedrockBearerTokenCredential.tryLoad({
                env: { AWS_BEARER_TOKEN_BEDROCK: "environment-token" },
            }),
        ).toMatchObject({
            credential: { bearerToken: "environment-token" },
        });

        expect(
            await BedrockBearerTokenCredential.tryLoad({
                bearerTokenEnvVar: "WORK_BEDROCK_TOKEN",
                env: { WORK_BEDROCK_TOKEN: "custom-token" },
            }),
        ).toMatchObject({
            credential: { bearerToken: "custom-token" },
        });

        expect(await BedrockBearerTokenCredential.tryLoad({ env: {} })).toBeNull();
    });

    it("loads gemini api key credentials from explicit and env sources", async () => {
        expect(
            await GeminiApiKeyCredential.tryLoad({ apiKey: "explicit-gemini-key", env: {} }),
        ).toMatchObject({
            name: "gemini-api-key",
            credential: { apiKey: "explicit-gemini-key" },
        });

        expect(
            await GeminiApiKeyCredential.tryLoad({
                env: { GEMINI_API_KEY: "environment-gemini-key" },
            }),
        ).toMatchObject({
            credential: { apiKey: "environment-gemini-key" },
        });

        expect(await GeminiApiKeyCredential.tryLoad({ env: {} })).toBeNull();
        expect(await GeminiApiKeyCredential.tryLoad({ env: { GEMINI_API_KEY: "  " } })).toBeNull();
    });

    it("loads claude credentials from oauth, api key, and auth token sources", async () => {
        expect(
            await ClaudeOAuthCredential.tryLoad({ oauthToken: "explicit-oauth", env: {} }),
        ).toMatchObject({
            name: "claude-oauth",
            credential: { accessToken: "explicit-oauth" },
        });

        expect(
            await ClaudeOAuthCredential.tryLoad({
                env: { CLAUDE_CODE_OAUTH_TOKEN: "environment-oauth" },
            }),
        ).toMatchObject({
            credential: { accessToken: "environment-oauth" },
        });

        const configDir = await writeClaudeConfigDir({
            claudeAiOauth: {
                accessToken: "stored-oauth",
            },
        });
        expect(
            await ClaudeOAuthCredential.tryLoad({
                configDir,
                env: {},
            }),
        ).toMatchObject({
            credential: { accessToken: "stored-oauth" },
        });

        expect(
            await ClaudeApiKeyCredential.tryLoad({ apiKey: "explicit-api-key", env: {} }),
        ).toMatchObject({
            name: "claude-api-key",
            credential: { apiKey: "explicit-api-key" },
        });
        expect(
            await ClaudeApiKeyCredential.tryLoad({
                env: { ANTHROPIC_API_KEY: "environment-api-key" },
            }),
        ).toMatchObject({
            credential: { apiKey: "environment-api-key" },
        });

        expect(
            await ClaudeAuthTokenCredential.tryLoad({ authToken: "explicit-auth-token", env: {} }),
        ).toMatchObject({
            name: "claude-auth-token",
            credential: { authToken: "explicit-auth-token" },
        });
        expect(
            await ClaudeAuthTokenCredential.tryLoad({
                env: { ANTHROPIC_AUTH_TOKEN: "environment-auth-token" },
            }),
        ).toMatchObject({
            credential: { authToken: "environment-auth-token" },
        });

        const emptyConfigDir = await mkdtemp(join(tmpdir(), "rig-providers-claude-empty-"));
        tempDirs.push(emptyConfigDir);

        expect(await ClaudeOAuthCredential.tryLoad({ configDir: emptyConfigDir, env: {} })).toBeNull();
        expect(await ClaudeApiKeyCredential.tryLoad({ env: {} })).toBeNull();
        expect(await ClaudeAuthTokenCredential.tryLoad({ env: {} })).toBeNull();
    });
});

async function writeClaudeConfigDir(credentials: unknown): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "rig-providers-claude-config-"));
    tempDirs.push(directory);
    await writeFile(join(directory, ".credentials.json"), JSON.stringify(credentials));
    return directory;
}

async function writeAuthFile(contents: unknown): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "rig-providers-credentials-"));
    tempDirs.push(directory);
    const authFile = join(directory, "auth.json");
    await writeFile(authFile, JSON.stringify(contents));
    return authFile;
}
