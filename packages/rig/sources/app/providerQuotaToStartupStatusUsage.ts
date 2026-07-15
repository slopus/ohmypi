import type { ProviderQuota, ProviderQuotaWindow } from "../providers/providerQuota.js";
import { formatResetDuration } from "./formatResetDuration.js";
import type {
    StartupStatusCardUsage,
    StartupStatusCardUsageWindow,
} from "./StartupStatusCardModel.js";

export function providerQuotaToStartupStatusUsage(
    quota: ProviderQuota | undefined,
    now = Date.now(),
): StartupStatusCardUsage | undefined {
    const fiveHour = mapWindow(quota?.windows.fiveHour, now);
    const weekly = mapWindow(quota?.windows.weekly, now);
    if (fiveHour === undefined && weekly === undefined) return undefined;
    return {
        ...(fiveHour === undefined ? {} : { fiveHour }),
        ...(weekly === undefined ? {} : { weekly }),
    };
}

function mapWindow(
    window: ProviderQuotaWindow | undefined,
    now: number,
): StartupStatusCardUsageWindow | undefined {
    if (window?.status !== "available") return undefined;
    return {
        capturedAt: window.capturedAt,
        percentLeft: Math.max(0, Math.min(100, 100 - window.usedPercent)),
        resetsIn: formatResetDuration(window.resetsAt - now),
    };
}
