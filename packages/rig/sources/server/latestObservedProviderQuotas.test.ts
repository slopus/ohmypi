import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import type { ProviderQuota } from "../providers/providerQuota.js";
import { latestObservedProviderQuotas } from "./latestObservedProviderQuotas.js";

describe("latestObservedProviderQuotas", () => {
    it("keeps the newest durable quota independently for each provider", () => {
        const events = [
            observed("codex-old", "codex", quota("codex", 1, 20)),
            observed("claude", "claude-sdk", quota("claude-sdk", 2, 30)),
            observed("codex-new", "codex", quota("codex", 3, 40)),
        ];

        expect([...latestObservedProviderQuotas(events)]).toEqual([
            ["codex", quota("codex", 3, 40)],
            ["claude-sdk", quota("claude-sdk", 2, 30)],
        ]);
    });
});

function observed(id: string, providerId: string, observedQuota: ProviderQuota): SessionEvent {
    return {
        createdAt: observedQuota.capturedAt,
        data: {
            observationId: id,
            phase: "after",
            providerId,
            quota: observedQuota,
            runId: id,
        },
        id,
        sessionId: "session",
        type: "provider_quota_observed",
    };
}

function quota(
    source: "codex" | "claude-sdk",
    capturedAt: number,
    usedPercent: number,
): ProviderQuota {
    return {
        capturedAt,
        source,
        windows: {
            fiveHour: { resetsAt: 100, status: "available", usedPercent },
            weekly: { status: "unavailable" },
        },
    };
}
