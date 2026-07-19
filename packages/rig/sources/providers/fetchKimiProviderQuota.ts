import { KIMI_DEFAULT_BASE_URL } from "./kimi-constants.js";
import type { ProviderQuota, ProviderQuotaWindow } from "./providerQuota.js";
import { resolveKimiCredential } from "./resolveKimiCredential.js";
import { unavailableProviderQuota } from "./unavailableProviderQuota.js";

const DEFAULT_KIMI_QUOTA_TIMEOUT_MS = 5_000;

const FIVE_HOURS_SECONDS = 5 * 60 * 60;
const WEEK_SECONDS = 7 * 24 * 60 * 60;

export interface FetchKimiProviderQuotaOptions {
    apiKey?: string;
    authFile?: string;
    baseUrl?: string;
    env?: NodeJS.ProcessEnv;
    fetch?: typeof fetch;
    now?: () => number;
    resolveCredential?: typeof resolveKimiCredential;
    timeoutMs?: number;
}

export async function fetchKimiProviderQuota(
    options: FetchKimiProviderQuotaOptions = {},
): Promise<ProviderQuota> {
    const now = options.now ?? Date.now;
    const unavailable = (): ProviderQuota => unavailableProviderQuota("kimi", now());
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_KIMI_QUOTA_TIMEOUT_MS;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
            () => {
                const error = new Error("Kimi quota request timed out.");
                controller.abort(error);
                reject(error);
            },
            Math.max(0, timeoutMs),
        );
    });

    try {
        const credential = await Promise.race([
            (options.resolveCredential ?? resolveKimiCredential)({
                ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
                ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
                ...(options.env === undefined ? {} : { env: options.env }),
                ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
                now,
            }),
            timedOut,
        ]);
        // Plan limits only exist for the managed Kimi Code subscription; raw
        // Moonshot API keys are pay-per-token and have no quota windows.
        if (credential.source !== "session") {
            return unavailable();
        }

        const baseUrl = (options.baseUrl ?? KIMI_DEFAULT_BASE_URL).replace(/\/+$/, "");
        const response = await Promise.race([
            (options.fetch ?? fetch)(`${baseUrl}/usages`, {
                method: "GET",
                headers: {
                    accept: "application/json",
                    authorization: `Bearer ${credential.token}`,
                },
                signal: controller.signal,
            }),
            timedOut,
        ]);
        if (!response.ok) {
            return unavailable();
        }

        const body = (await response.json()) as KimiUsagePayload;
        const capturedAt = now();
        return {
            capturedAt,
            source: "kimi",
            windows: parseKimiUsageWindows(body, capturedAt),
        };
    } catch {
        return unavailable();
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
    }
}

interface KimiUsageRowPayload {
    limit?: unknown;
    used?: unknown;
    remaining?: unknown;
    reset_at?: unknown;
    resetAt?: unknown;
    reset_time?: unknown;
    resetTime?: unknown;
    reset_in?: unknown;
    resetIn?: unknown;
    ttl?: unknown;
    window?: unknown;
    duration?: unknown;
    timeUnit?: unknown;
}

interface KimiUsageLimitPayload extends KimiUsageRowPayload {
    detail?: unknown;
}

interface KimiUsagePayload {
    usage?: unknown;
    limits?: unknown;
}

function parseKimiUsageWindows(
    payload: KimiUsagePayload,
    capturedAt: number,
): ProviderQuota["windows"] {
    const windows: ProviderQuota["windows"] = {
        fiveHour: { status: "unavailable" },
        weekly: { status: "unavailable" },
    };

    const weekly = parseKimiUsageRow(payload.usage, capturedAt, undefined);
    if (weekly !== undefined) {
        windows.weekly = weekly;
    }

    if (Array.isArray(payload.limits)) {
        for (const rawLimit of payload.limits) {
            if (!isRecord(rawLimit)) continue;
            const item = rawLimit as KimiUsageLimitPayload;
            const row = isRecord(item.detail) ? (item.detail as KimiUsageRowPayload) : item;
            const windowPayload = isRecord(item.window) ? item.window : undefined;
            const durationSeconds = kimiWindowDurationSeconds(item, row, windowPayload);
            const key =
                durationSeconds === undefined
                    ? undefined
                    : durationMatches(durationSeconds, FIVE_HOURS_SECONDS)
                      ? "fiveHour"
                      : durationMatches(durationSeconds, WEEK_SECONDS)
                        ? "weekly"
                        : undefined;
            if (key === undefined) continue;
            const existing: ProviderQuotaWindow | undefined = windows[key];
            if (existing?.status === "available") continue;
            const parsed = parseKimiUsageRow(row, capturedAt, durationSeconds);
            if (parsed !== undefined) {
                windows[key] = parsed;
            }
        }
    }

    return windows;
}

function parseKimiUsageRow(
    raw: unknown,
    capturedAt: number,
    durationSeconds: number | undefined,
): ProviderQuotaWindow | undefined {
    if (!isRecord(raw)) return undefined;
    const row = raw as KimiUsageRowPayload;
    const limit = toFiniteNumber(row.limit);
    let used = toFiniteNumber(row.used);
    if (used === undefined) {
        const remaining = toFiniteNumber(row.remaining);
        if (remaining !== undefined && limit !== undefined) {
            used = Math.max(0, limit - remaining);
        }
    }
    if (limit === undefined || limit <= 0 || used === undefined) return undefined;
    const resetsAt = kimiRowResetsAt(row, capturedAt);
    if (resetsAt === undefined) return undefined;
    return {
        capturedAt,
        status: "available",
        usedPercent: Math.round(Math.max(0, Math.min(1, used / limit)) * 1_000) / 10,
        resetsAt,
        ...(durationSeconds === undefined ? {} : { durationMs: durationSeconds * 1_000 }),
    };
}

function kimiRowResetsAt(row: KimiUsageRowPayload, capturedAt: number): number | undefined {
    for (const value of [row.reset_at, row.resetAt, row.reset_time, row.resetTime]) {
        if (typeof value !== "string" || value.length === 0) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    for (const value of [row.reset_in, row.resetIn, row.ttl, row.window]) {
        const seconds = toInteger(value);
        if (seconds !== undefined && seconds > 0) {
            return capturedAt + seconds * 1_000;
        }
    }
    return undefined;
}

function kimiWindowDurationSeconds(
    item: KimiUsageLimitPayload,
    row: KimiUsageRowPayload,
    windowPayload: Record<string, unknown> | undefined,
): number | undefined {
    const duration = toInteger(windowPayload?.["duration"] ?? item.duration ?? row.duration);
    if (duration === undefined || duration <= 0) return undefined;
    const timeUnitRaw = windowPayload?.["timeUnit"] ?? item.timeUnit ?? row.timeUnit;
    const timeUnit = typeof timeUnitRaw === "string" ? timeUnitRaw : "";
    if (timeUnit.includes("MINUTE")) return duration * 60;
    if (timeUnit.includes("HOUR")) return duration * 3_600;
    if (timeUnit.includes("DAY")) return duration * 86_400;
    return duration;
}

function durationMatches(actualSeconds: number, expectedSeconds: number): boolean {
    return Math.abs(actualSeconds - expectedSeconds) <= expectedSeconds * 0.05;
}

function toInteger(value: unknown): number | undefined {
    const parsed = toFiniteNumber(value);
    return parsed === undefined ? undefined : Math.trunc(parsed);
}

function toFiniteNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && !Array.isArray(value) && typeof value === "object";
}
