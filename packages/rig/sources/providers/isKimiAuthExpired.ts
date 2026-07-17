import type { KimiAuthRecord } from "./kimi-auth-types.js";

export function isKimiAuthExpired(
    record: KimiAuthRecord,
    options: { force?: boolean; now: number },
): boolean {
    if (options.force === true) return true;
    if (record.expires_at === 0) return false;
    const refreshThreshold = Math.max(300, record.expires_in * 0.5);
    return record.expires_at - options.now < refreshThreshold;
}
