import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchKimiProviderQuota } from "./fetchKimiProviderQuota.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    );
});

describe("fetchKimiProviderQuota", () => {
    it("fetches weekly and five-hour windows from the managed usages endpoint", async () => {
        const authFile = await writeAuthFile({ access_token: "kimi-token" });
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            Response.json({
                usage: {
                    limit: 100,
                    used: 14,
                    reset_at: "2025-01-08T00:00:00Z",
                },
                limits: [
                    {
                        detail: { limit: 50, used: 3.5, reset_in: 12_000 },
                        window: { duration: 5, timeUnit: "HOUR" },
                    },
                ],
            }),
        );

        const quota = await fetchKimiProviderQuota({
            authFile,
            baseUrl: "https://example.test/coding/v1/",
            fetch: fetchMock,
            now: () => 123_000,
        });

        expect(quota).toEqual({
            capturedAt: 123_000,
            source: "kimi",
            windows: {
                fiveHour: {
                    capturedAt: 123_000,
                    durationMs: 18_000_000,
                    resetsAt: 12_123_000,
                    status: "available",
                    usedPercent: 7,
                },
                weekly: {
                    capturedAt: 123_000,
                    resetsAt: Date.parse("2025-01-08T00:00:00Z"),
                    status: "available",
                    usedPercent: 14,
                },
            },
        });
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe("https://example.test/coding/v1/usages");
        expect(init?.method).toBe("GET");
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer kimi-token");
        expect(new Headers(init?.headers).get("accept")).toBe("application/json");
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it("derives used tokens from remaining and matches minute-based five-hour windows", async () => {
        const authFile = await writeAuthFile({ access_token: "kimi-token" });
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            Response.json({
                usage: { limit: 200, remaining: 172, reset_time: "2025-01-08T00:00:00.000Z" },
                limits: [
                    {
                        detail: { limit: 40, remaining: 36, ttl: 600 },
                        duration: 300,
                        timeUnit: "MINUTE",
                    },
                ],
            }),
        );

        const quota = await fetchKimiProviderQuota({
            authFile,
            fetch: fetchMock,
            now: () => 1_000,
        });

        expect(quota.windows.weekly).toMatchObject({
            status: "available",
            usedPercent: 14,
        });
        expect(quota.windows.fiveHour).toMatchObject({
            durationMs: 18_000_000,
            resetsAt: 601_000,
            status: "available",
            usedPercent: 10,
        });
    });

    it("matches five-hour window metadata nested inside the detail row", async () => {
        const authFile = await writeAuthFile({ access_token: "kimi-token" });
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            Response.json({
                limits: [
                    {
                        detail: {
                            duration: 5,
                            limit: 50,
                            reset_in: 12_000,
                            timeUnit: "HOUR",
                            used: 4,
                        },
                    },
                ],
            }),
        );

        const quota = await fetchKimiProviderQuota({
            authFile,
            fetch: fetchMock,
            now: () => 1_000,
        });

        expect(quota.windows.fiveHour).toEqual({
            capturedAt: 1_000,
            durationMs: 18_000_000,
            resetsAt: 12_001_000,
            status: "available",
            usedPercent: 8,
        });
    });

    it("bounds credential resolution with the overall quota timeout", async () => {
        vi.useFakeTimers();
        try {
            const quotaPromise = fetchKimiProviderQuota({
                now: () => 5_000,
                resolveCredential: () => new Promise(() => undefined),
                timeoutMs: 25,
            });

            await vi.advanceTimersByTimeAsync(25);

            await expect(quotaPromise).resolves.toEqual({
                capturedAt: 5_000,
                source: "kimi",
                windows: {
                    fiveHour: { status: "unavailable" },
                    weekly: { status: "unavailable" },
                },
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("reports unavailable windows when the subscription is not signed in", async () => {
        const fetchMock = vi.fn<typeof fetch>();

        const quota = await fetchKimiProviderQuota({
            authFile: path.join(await temporaryDirectory(), "missing.json"),
            fetch: fetchMock,
            now: () => 5_000,
        });

        expect(quota).toEqual({
            capturedAt: 5_000,
            source: "kimi",
            windows: {
                fiveHour: { status: "unavailable" },
                weekly: { status: "unavailable" },
            },
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips the managed usages endpoint for raw API keys", async () => {
        const fetchMock = vi.fn<typeof fetch>();

        const quota = await fetchKimiProviderQuota({
            apiKey: "sk-moonshot-key",
            fetch: fetchMock,
            now: () => 5_000,
        });

        expect(quota.windows.weekly).toEqual({ status: "unavailable" });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reports unavailable windows when the endpoint rejects the session", async () => {
        const authFile = await writeAuthFile({ access_token: "kimi-token" });
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response("nope", { status: 401 }));

        const quota = await fetchKimiProviderQuota({
            authFile,
            fetch: fetchMock,
            now: () => 5_000,
        });

        expect(quota).toEqual({
            capturedAt: 5_000,
            source: "kimi",
            windows: {
                fiveHour: { status: "unavailable" },
                weekly: { status: "unavailable" },
            },
        });
    });
});

async function writeAuthFile(record: Record<string, unknown>): Promise<string> {
    const directory = await temporaryDirectory();
    const authFile = path.join(directory, "kimi-code.json");
    await writeFile(authFile, JSON.stringify({ refresh_token: "refresh", ...record }), "utf8");
    return authFile;
}

async function temporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(path.join(tmpdir(), "rig-kimi-quota-"));
    temporaryDirectories.push(directory);
    return directory;
}
