import { describe, expect, it } from "vitest";

import { renderSubagentSummary } from "./renderSubagentSummary.js";
import { stripAnsi } from "./testing/stripAnsi.js";

describe("renderSubagentSummary", () => {
    it("uses compact grammar and truncates to the terminal width", () => {
        expect(renderSubagentSummary(0, 80)).toBeUndefined();
        expect(renderSubagentSummary(1, 80)).toContain("1 agent running · /agents to view");
        expect(renderSubagentSummary(2, 80)).toContain("2 agents running · /agents to view");
        expect(stripAnsi(renderSubagentSummary(2, 20) ?? "").length).toBeLessThanOrEqual(20);
    });
});
