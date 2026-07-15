import { describe, expect, it } from "vitest";

import { terminalRowStyleRuns } from "./terminalRowStyleRuns.js";

describe("terminalRowStyleRuns", () => {
    it("combines same-style glyphs across implicit spaces and preserves style boundaries", () => {
        const snapshot = {
            cells: [cell("A", 2, true), cell("B", 4, true), cell("C", 5, false)],
        };

        expect(terminalRowStyleRuns(snapshot, 0)).toEqual([
            {
                background: null,
                bold: true,
                dim: false,
                foreground: null,
                italic: false,
                text: "A B",
                x: 2,
            },
            {
                background: null,
                bold: false,
                dim: false,
                foreground: null,
                italic: false,
                text: "C",
                x: 5,
            },
        ]);
    });
});

function cell(text: string, x: number, bold: boolean) {
    return {
        background: null,
        bold,
        dim: false,
        foreground: null,
        italic: false,
        text,
        x,
        y: 0,
    };
}
