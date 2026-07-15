import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ProviderQuota } from "./providerQuota.js";
import { readCodexQuotaAuth } from "./readCodexQuotaAuth.js";
import { unavailableProviderQuota } from "./unavailableProviderQuota.js";

const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const DEFAULT_CODEX_QUOTA_TIMEOUT_MS = 5_000;

export interface FetchCodexProviderQuotaOptions {
    authPath?: string;
    baseUrl?: string;
    fetch?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
}

export async function fetchCodexProviderQuota(
    options: FetchCodexProviderQuotaOptions = {},
): Promise<ProviderQuota> {
    const now = options.now ?? Date.now;
    const unavailable = (): ProviderQuota => unavailableProviderQuota("codex", now());

    try {
        const authFile = options.authPath ?? path.join(homedir(), ".codex", "auth.json");
        const auth = readCodexQuotaAuth(await readFile(authFile, "utf8"));
        if (auth === undefined) {
            return unavailable();
        }

        const headers = new Headers({ authorization: `Bearer ${auth.accessToken}` });
        if (auth.accountId !== undefined) {
            headers.set("chatgpt-account-id", auth.accountId);
        }

        const baseUrl = (options.baseUrl ?? DEFAULT_CODEX_BASE_URL).replace(/\/+$/, "");
        const response = await (options.fetch ?? fetch)(`${baseUrl}/wham/usage`, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_CODEX_QUOTA_TIMEOUT_MS),
        });
        if (!response.ok) {
            return unavailable();
        }

        const body = (await response.json()) as {
            rate_limit?: {
                primary_window?: CodexQuotaWindowPayload | null;
                secondary_window?: CodexQuotaWindowPayload | null;
            } | null;
        };
        const windows = parseCodexQuotaWindows([
            body.rate_limit?.primary_window,
            body.rate_limit?.secondary_window,
        ]);
        return {
            capturedAt: now(),
            source: "codex",
            windows,
        };
    } catch {
        return unavailable();
    }
}

interface CodexQuotaWindowPayload {
    limit_window_seconds?: unknown;
    reset_at?: unknown;
    used_percent?: unknown;
}

function parseCodexQuotaWindows(
    payloads: readonly (CodexQuotaWindowPayload | null | undefined)[],
): ProviderQuota["windows"] {
    const windows: ProviderQuota["windows"] = {
        fiveHour: { status: "unavailable" },
        weekly: { status: "unavailable" },
    };
    for (const payload of payloads) {
        if (payload == null) continue;
        const durationSeconds = payload?.limit_window_seconds;
        if (
            typeof durationSeconds !== "number" ||
            !Number.isSafeInteger(durationSeconds) ||
            durationSeconds <= 0
        ) {
            continue;
        }
        const key = durationMatches(durationSeconds, 5 * 60 * 60)
            ? "fiveHour"
            : durationMatches(durationSeconds, 7 * 24 * 60 * 60)
              ? "weekly"
              : undefined;
        if (key !== undefined) windows[key] = parseCodexQuotaWindow(payload, durationSeconds);
    }
    return windows;
}

function parseCodexQuotaWindow(
    payload: CodexQuotaWindowPayload,
    durationSeconds: number,
): ProviderQuota["windows"]["fiveHour"] {
    const usedPercent = payload?.used_percent;
    const resetAtSeconds = payload?.reset_at;
    if (
        typeof usedPercent !== "number" ||
        !Number.isFinite(usedPercent) ||
        usedPercent < 0 ||
        usedPercent > 100 ||
        typeof resetAtSeconds !== "number" ||
        !Number.isSafeInteger(resetAtSeconds) ||
        resetAtSeconds < 0
    ) {
        return { status: "unavailable" };
    }
    return {
        status: "available",
        usedPercent,
        resetsAt: resetAtSeconds * 1_000,
        durationMs: durationSeconds * 1_000,
    };
}

function durationMatches(actualSeconds: number, expectedSeconds: number): boolean {
    return Math.abs(actualSeconds - expectedSeconds) <= expectedSeconds * 0.05;
}
