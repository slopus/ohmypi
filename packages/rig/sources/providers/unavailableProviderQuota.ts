import type { ProviderQuota, ProviderQuotaSource } from "./providerQuota.js";

export function unavailableProviderQuota(
    source: ProviderQuotaSource,
    capturedAt: number,
): ProviderQuota {
    return {
        capturedAt,
        source,
        windows: {
            fiveHour: { status: "unavailable" },
            weekly: { status: "unavailable" },
        },
    };
}
