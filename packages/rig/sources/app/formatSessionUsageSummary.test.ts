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
    it("renders compact provider sections, quota, context, and total", () => {
        expect(
            formatSessionUsageSummary(summary(), [{ model: codex, providerId: "codex" }], 1_000),
        ).toBe(
            [
                "Codex",
                "GPT-5.6 · 1.2k in · 100 out · 40 read · 30 write · 1.4k total",
                "5-hour: 68% left · resets in 2h 14m",
                "Context: 1.3k / 200k · 99% left",
                "Earlier usage",
                "Model unavailable · 5 in · 2 out · 0 read · 0 write · 7 total",
                "Total: 1.4k",
            ].join("\n"),
        );
    });

    it("marks approximate context and unavailable quota without estimates", () => {
        const value = summary();
        value.context = { ...value.context!, approximate: true };
        value.quota = {
            capturedAt: 1_000,
            source: "codex",
            status: "unavailable",
            window: "five_hour",
        };

        const text = formatSessionUsageSummary(value, [{ model: codex, providerId: "codex" }]);
        expect(text).toContain("5-hour: unavailable");
        expect(text).toContain("Context: ~1.3k / 200k");
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
                usage: usage(1_200, 100, 40, 30, 1_370),
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
        quota: {
            capturedAt: 1_000,
            resetsAt: 1_000 + (2 * 60 + 14) * 60_000,
            source: "codex",
            status: "available",
            usedPercent: 32,
            window: "five_hour",
        },
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
