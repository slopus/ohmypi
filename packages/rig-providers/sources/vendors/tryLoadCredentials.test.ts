import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { tryLoadCredentials } from "@/vendors/tryLoadCredentials.js";
import { GROK_API_KEY_SCOPE } from "@/vendors/grok/impl/auth.js";

describe("tryLoadCredentials", () => {
    it("loads every credential type that is available", async () => {
        const grokAuthFile = await writeAuthFile({
            [GROK_API_KEY_SCOPE]: {
                auth_mode: "api_key",
                key: "grok-key",
            },
        });
        const codexAuthFile = await writeAuthFile({
            tokens: {
                access_token: "codex-access-token",
            },
        });
        const claudeConfigDir = await writeClaudeConfigDir({
            claudeAiOauth: {
                accessToken: "claude-oauth",
            },
        });

        const credentials = await tryLoadCredentials({
            bedrockBearerToken: "bedrock-token",
            claudeApiKey: "claude-api-key",
            claudeAuthToken: "claude-auth-token",
            claudeConfigDir,
            claudeOAuthToken: "explicit-claude-oauth",
            codexApiKey: "codex-api-key",
            codexAuthFile,
            env: {},
            geminiApiKey: "gemini-api-key",
            grokAuthFile,
        });

        expect(credentials.map((credential) => credential.name).sort()).toEqual([
            "bedrock-bearer-token",
            "claude-api-key",
            "claude-auth-token",
            "claude-oauth",
            "codex-api-key",
            "codex-session",
            "gemini-api-key",
            "grok-api-key",
        ]);
    });

    it("returns an empty array when nothing is available", async () => {
        const emptyDir = await mkdtemp(join(tmpdir(), "rig-providers-empty-credentials-"));

        expect(
            await tryLoadCredentials({
                claudeConfigDir: emptyDir,
                codexAuthFile: join(emptyDir, "codex-auth.json"),
                env: {},
                grokAuthFile: join(emptyDir, "grok-auth.json"),
            }),
        ).toEqual([]);
    });
});

async function writeClaudeConfigDir(credentials: unknown): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "rig-providers-claude-config-"));
    await writeFile(join(directory, ".credentials.json"), JSON.stringify(credentials));
    return directory;
}

async function writeAuthFile(contents: unknown): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "rig-providers-credentials-"));
    const authFile = join(directory, "auth.json");
    await writeFile(authFile, JSON.stringify(contents));
    return authFile;
}
