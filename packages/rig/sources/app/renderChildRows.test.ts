import { describe, expect, it } from "vitest";

import { renderChildRows } from "./renderChildRows.js";

describe("renderChildRows", () => {
    it("uses one branch marker for wrapped and subsequent rows", () => {
        expect(
            renderChildRows(
                [
                    { text: "alpha beta gamma", wrap: true },
                    { text: "delta", wrap: true },
                ],
                { width: 12 },
            ).map((line) => line.trimEnd()),
        ).toEqual(["  └ alpha", "    beta", "    gamma", "    delta"]);
    });

    it("limits a child preview without adding another marker", () => {
        expect(
            renderChildRows(
                [
                    { lineLimit: 2, text: "alpha beta gamma", wrap: true },
                    { text: "delta", wrap: true },
                ],
                { width: 12 },
            ).map((line) => line.trimEnd()),
        ).toEqual(["  └ alpha", "    beta", "    delta"]);
    });
});
