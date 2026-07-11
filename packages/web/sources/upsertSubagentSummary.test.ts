import { describe, expect, it } from "vitest";

import type { SubagentSummary } from "./protocol";
import { upsertSubagentSummary } from "./upsertSubagentSummary";

describe("upsertSubagentSummary", () => {
    it("updates a running child in place when it finishes", () => {
        const running = subagentSummary({ status: "running", updatedAt: 2 });
        const completed = subagentSummary({ status: "completed", updatedAt: 3 });

        expect(upsertSubagentSummary([running], completed)).toEqual([completed]);
    });
});

function subagentSummary(overrides: Partial<SubagentSummary>): SubagentSummary {
    return {
        agentId: "agent-2",
        createdAt: 1,
        depth: 1,
        description: "Inspect the interface",
        id: "subagent-1",
        modelId: "openai/gpt-5.5",
        parentSessionId: "session-1",
        status: "running",
        updatedAt: 2,
        ...overrides,
    };
}
