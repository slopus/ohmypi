import { readFile } from "node:fs/promises";

import type { KimiAuthRecord } from "./kimi-auth-types.js";

export async function readKimiAuthRecord(path: string): Promise<KimiAuthRecord | undefined> {
    let source: string;
    try {
        source = await readFile(path, "utf8");
    } catch (error) {
        if (isFileNotFound(error)) return undefined;
        throw error;
    }

    let value: unknown;
    try {
        value = JSON.parse(source);
    } catch {
        return undefined;
    }
    if (!isRecord(value)) return undefined;
    const accessToken = stringField(value, "access_token");
    const refreshToken = stringField(value, "refresh_token");
    if (accessToken === undefined || refreshToken === undefined) return undefined;
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: numberField(value, "expires_at"),
        expires_in: numberField(value, "expires_in"),
        scope: stringField(value, "scope") ?? "",
        token_type: stringField(value, "token_type") ?? "Bearer",
    };
}

function isFileNotFound(error: unknown): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && !Array.isArray(value) && typeof value === "object";
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
    const field = value[key];
    return typeof field === "string" ? field : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number {
    const field = value[key];
    return typeof field === "number" && Number.isFinite(field) ? field : 0;
}
