import { describe, expect, it } from "vitest";

import { renderWorkflowSummary } from "./renderWorkflowSummary.js";

describe("renderWorkflowSummary", () => {
    it("uses compact grammar and truncates to the terminal width", () => {
        expect(renderWorkflowSummary(0, 80)).toBeUndefined();
        expect(renderWorkflowSummary(1, 80)).toContain("1 workflow running · /workflows to view");
        expect(renderWorkflowSummary(2, 80)).toContain("2 workflows running · /workflows to view");
        expect(stripAnsi(renderWorkflowSummary(2, 24) ?? "").length).toBeLessThanOrEqual(24);
    });
});

function stripAnsi(value: string): string {
    return value.replaceAll(/\x1b\[[0-9;]*m/gu, "");
}
