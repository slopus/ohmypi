import { describe, expect, it } from "vitest";

import { quoteVisibleExact } from "./quoteVisibleExact.js";

describe("quoteVisibleExact", () => {
    it("keeps complete text while escaping terminal and bidi controls", () => {
        const value = `safe\u0003\u202emasked\n${"x".repeat(140)}\tend`;

        expect(quoteVisibleExact(value)).toBe(
            `"safe\\u{0003}\\u{202e}masked\\n${"x".repeat(140)}\\tend"`,
        );
    });
});
