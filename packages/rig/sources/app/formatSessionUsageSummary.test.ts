import { describe, expect, it } from "vitest";

import type { GetSessionUsageResponse } from "../protocol/index.js";
import { defineModel } from "../providers/types.js";
import { formatSessionUsageSummary } from "./formatSessionUsageSummary.js";

const codex = defineModel({
    contextWindow: 200_000,
    defaultThinkingLevel: "high",
    id: "openai/gpt-5.6",
    name: "GPT-5.6",
    thinkingLevels: ["high"],
});

describe("formatSessionUsageSummary", () => {
    it("renders detailed compact tokens, both quota windows, observed movement, and context", () => {
        expect(
            formatSessionUsageSummary(summary(), [{ model: codex, providerId: "codex" }], 1_000),
        ).toBe(
            [
                "Codex",
                "GPT-5.6 · 1,200 in · 100 out · 40 read · 30 write · 20 reasoning · 1,370 total",
                "5-hour: 68% left · resets in 2h 14m",
                "Weekly: 79% left · resets in 6d 2h",
                "Observed while this session was active: 5h +3.5% · week +1% (approx.)",
                "Context: 1,300 / 200,000 · 99% left",
                "Earlier usage",
                "Model unavailable · 5 in · 2 out · 0 read · 0 write · 7 total",
                "Account usage may include other activity.",
                "Overall session total: 1,377",
            ].join("\n"),
        );
    });

    it("marks approximate context and unavailable windows without estimates", () => {
        const value = summary();
        value.context = { ...value.context!, approximate: true };
        value.quotas = [
            {
                providerId: "codex",
                quota: {
                    capturedAt: 1_000,
                    source: "codex",
                    windows: {
                        fiveHour: { status: "unavailable" },
                        weekly: { status: "unavailable" },
                    },
                },
            },
        ];
        value.observedQuota = [];

        const text = formatSessionUsageSummary(value, [{ model: codex, providerId: "codex" }]);
        expect(text).toContain("5-hour: unavailable");
        expect(text).toContain("Weekly: unavailable");
        expect(text).toContain(
            "Observed while this session was active: 5h unavailable · week unavailable (approx.)",
        );
        expect(text).toContain("Context: ~1,300 / 200,000");
    });

    it("shows authoritative Claude cost and keeps provider observations separate", () => {
        const value = summary();
        value.currentProviderId = "claude-sdk";
        value.groups = [
            ...value.groups,
            {
                kind: "attributed",
                modelId: "anthropic/sonnet-4-6",
                providerId: "claude-sdk",
                usage: {
                    ...usage(100, 20, 0, 0, 120),
                    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0.1234 },
                },
            },
        ];
        value.observedQuota = [
            ...value.observedQuota,
            {
                providerId: "claude-sdk",
                windows: {
                    fiveHour: { observedUsedPercent: 0 },
                    weekly: { observedUsedPercent: 2 },
                },
            },
        ];

        const text = formatSessionUsageSummary(value, [{ model: codex, providerId: "codex" }]);
        expect(text).toContain("anthropic/sonnet-4-6 · 100 in · 20 out");
        expect(text).toContain("120 total · $0.12");
        expect(text).toContain(
            "Observed while this session was active: 5h +0% · week +2% (approx.)",
        );
        expect(text).toContain("Account usage may include other activity.");
    });
});

function summary(): GetSessionUsageResponse {
    return {
        context: {
            approximate: false,
            modelId: codex.id,
            providerId: "codex",
            requestedModelId: codex.id,
            totalTokens: 1_300,
        },
        currentProviderId: "codex",
        groups: [
            {
                kind: "attributed",
                modelId: codex.id,
                providerId: "codex",
                usage: { ...usage(1_200, 100, 40, 30, 1_370), reasoning: 20 },
            },
            {
                kind: "earlier",
                label: "Earlier usage",
                modelId: null,
                modelLabel: "Model unavailable",
                providerId: null,
                requestedModelId: null,
                usage: usage(5, 2, 0, 0, 7),
            },
        ],
        observedQuota: [
            {
                providerId: "codex",
                windows: {
                    fiveHour: { observedUsedPercent: 3.5 },
                    weekly: { observedUsedPercent: 1 },
                },
            },
        ],
        quotas: [
            {
                providerId: "codex",
                quota: {
                    capturedAt: 1_000,
                    source: "codex",
                    windows: {
                        fiveHour: {
                            capturedAt: 1_000,
                            resetsAt: 1_000 + (2 * 60 + 14) * 60_000,
                            status: "available",
                            usedPercent: 32,
                        },
                        weekly: {
                            capturedAt: 1_000,
                            resetsAt: 1_000 + (6 * 24 + 2) * 60 * 60_000,
                            status: "available",
                            usedPercent: 21,
                        },
                    },
                },
            },
        ],
    };
}

function usage(
    input: number,
    output: number,
    cacheRead: number,
    cacheWrite: number,
    total: number,
) {
    return {
        cacheRead,
        cacheWrite,
        cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
        input,
        output,
        totalTokens: total,
    };
}
