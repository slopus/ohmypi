import { describe, expect, it } from "vitest";

import type { SubagentSummary } from "../protocol/index.js";
import { formatSubagentRows } from "./formatSubagentRows.js";

describe("formatSubagentRows", () => {
    it("renders exact active-first rows with stable groups and nested descendants", () => {
        const completed = subagent("Completed first", "completed", 1, 4_000, 12_000);
        const running = {
            ...subagent("Running second", "running", 1, 1_250, 2_000),
            activeSince: 8_000,
        };
        const waiting = subagent("Waiting third", "queued", 1, 0, 0);
        const nested = subagent("Nested suspended", "suspended", 2, 65_000, 999);
        const failed = subagent("Failed last", "error", 1, 7_000, 40);

        expect(formatSubagentRows([completed, running, waiting, nested, failed], 10_000)).toEqual([
            "Running · Running second · 3s · 2.0k tokens",
            "Queued · Waiting third · 0s · 0 tokens",
            "  Suspended · Nested suspended · 1m 5s · 999 tokens",
            "Completed · Completed first · 4s · 12k tokens",
            "Failed · Failed last · 7s · 40 tokens",
        ]);
    });
});

function subagent(
    description: string,
    status: SubagentSummary["status"],
    depth: number,
    elapsedMs: number,
    totalTokens: number,
): SubagentSummary {
    return {
        agentId: description,
        createdAt: 0,
        depth,
        description,
        elapsedMs,
        id: description,
        modelId: "openai/test",
        parentSessionId: "root",
        status,
        totalTokens,
        updatedAt: 0,
    };
}
