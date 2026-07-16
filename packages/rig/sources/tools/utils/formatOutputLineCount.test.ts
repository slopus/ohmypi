import { describe, expect, it } from "vitest";

import { formatOutputLineCount } from "./formatOutputLineCount.js";

describe("formatOutputLineCount", () => {
    it("formats singular and plural output line counts", () => {
        expect(formatOutputLineCount("one")).toBe("1 output line");
        expect(formatOutputLineCount("one\ntwo")).toBe("2 output lines");
    });
});
