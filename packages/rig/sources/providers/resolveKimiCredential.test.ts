import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { KimiAuthRecord } from "./kimi-auth-types.js";
import { resolveKimiCredential } from "./resolveKimiCredential.js";

describe("resolveKimiCredential", () => {
    it("refreshes an expiring Kimi Code login once and atomically persists rotation", async () => {
        const root = await mkdtemp(join(tmpdir(), "rig-kimi-auth-"));
        const authFile = join(root, "credentials", "kimi-code.json");
        await mkdir(join(root, "credentials"), { recursive: true });
        await writeFile(authFile, JSON.stringify(record()), { mode: 0o600 });
        let releaseFetch: (() => void) | undefined;
        const fetchStarted = new Promise<void>((resolve) => {
            releaseFetch = resolve;
        });
        const fetch = vi.fn(
            async (_input: Parameters<typeof globalThis.fetch>[0], _init?: RequestInit) => {
                releaseFetch?.();
                return Response.json({
                    access_token: "fresh-access",
                    expires_in: 3_600,
                    refresh_token: "fresh-refresh",
                    scope: "openid",
                    token_type: "Bearer",
                });
            },
        );
        try {
            const options = {
                authFile,
                env: {} as NodeJS.ProcessEnv,
                fetch,
                now: () => 1_700_000_000_000,
            };
            const first = resolveKimiCredential(options);
            await fetchStarted;
            const second = resolveKimiCredential(options);
            expect(await Promise.all([first, second])).toEqual([
                { source: "session", token: "fresh-access" },
                { source: "session", token: "fresh-access" },
            ]);
            expect(fetch).toHaveBeenCalledTimes(1);
            const body = String((fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.body);
            expect(body).toContain("grant_type=refresh_token");
            expect(body).toContain("refresh_token=old-refresh");
            expect(JSON.parse(await readFile(authFile, "utf8"))).toMatchObject({
                access_token: "fresh-access",
                expires_at: 1_700_003_600,
                refresh_token: "fresh-refresh",
            });
            await expect(readFile(join(root, "oauth", "kimi-code.lock"), "utf8")).rejects.toThrow();
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it("locks a custom auth file in place without creating an oauth directory", async () => {
        const root = await mkdtemp(join(tmpdir(), "rig-kimi-auth-"));
        const projectDirectory = join(root, "project");
        await mkdir(projectDirectory, { recursive: true });
        const authFile = join(projectDirectory, "kimi.json");
        await writeFile(authFile, JSON.stringify(record()), { mode: 0o600 });
        const fetch = vi.fn(async () =>
            Response.json({
                access_token: "fresh-access",
                expires_in: 3_600,
                refresh_token: "fresh-refresh",
                scope: "openid",
                token_type: "Bearer",
            }),
        );
        try {
            await expect(
                resolveKimiCredential({ authFile, env: {}, fetch, now: () => 1_700_000_000_000 }),
            ).resolves.toEqual({ source: "session", token: "fresh-access" });
            expect(fetch).toHaveBeenCalledTimes(1);
            await expect(readdir(projectDirectory)).resolves.toEqual(["kimi.json"]);
            await expect(readdir(join(root, "oauth"))).rejects.toThrow();
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it("uses an unexpired login and gives a human login instruction when missing", async () => {
        const root = await mkdtemp(join(tmpdir(), "rig-kimi-auth-"));
        const authFile = join(root, "credentials", "kimi-code.json");
        await mkdir(join(root, "credentials"), { recursive: true });
        await writeFile(authFile, JSON.stringify({ ...record(), expires_at: 1_800_000_000 }), {
            mode: 0o600,
        });
        try {
            await expect(
                resolveKimiCredential({ authFile, env: {}, now: () => 1_700_000_000_000 }),
            ).resolves.toEqual({ source: "session", token: "old-access" });
            await expect(
                resolveKimiCredential({ authFile: join(root, "missing.json"), env: {} }),
            ).rejects.toThrow("Kimi Code is not signed in. Run `kimi login`.");
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });
});

function record(): KimiAuthRecord {
    return {
        access_token: "old-access",
        expires_at: 1_700_000_100,
        expires_in: 3_600,
        refresh_token: "old-refresh",
        scope: "openid",
        token_type: "Bearer",
    };
}
