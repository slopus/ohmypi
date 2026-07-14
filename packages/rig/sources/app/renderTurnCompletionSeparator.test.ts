import { describe, expect, it } from "vitest";

import { renderTurnCompletionSeparator } from "./renderTurnCompletionSeparator.js";

describe("renderTurnCompletionSeparator", () => {
    it("renders elapsed work as one width-bounded history row", () => {
        const rendered = stripAnsi(renderTurnCompletionSeparator(65_000, 40));
        expect(rendered).toContain("Worked for 1m 5s");
        expect(rendered).toHaveLength(40);
        expect(stripAnsi(renderTurnCompletionSeparator(0, 12))).toBe("─ Worked for");
        expect(stripAnsi(renderTurnCompletionSeparator(3_723_000, 24))).toHaveLength(24);
    });
});

function stripAnsi(value: string): string {
    return value.replaceAll(/\x1b\[[0-9;]*m/gu, "");
}
