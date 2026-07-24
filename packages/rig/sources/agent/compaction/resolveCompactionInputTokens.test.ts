import { describe, expect, it } from "vitest";

import { resolveCompactionInputTokens } from "./resolveCompactionInputTokens.js";

describe("resolveCompactionInputTokens", () => {
    it("preserves a larger provider count for native overflow recovery", () => {
        expect(resolveCompactionInputTokens(20_000, 80_000)).toBe(80_000);
    });

    it("keeps the selected-prefix estimate when no larger provider count exists", () => {
        expect(resolveCompactionInputTokens(60_000, 40_000)).toBe(60_000);
        expect(resolveCompactionInputTokens(49_999, undefined)).toBe(49_999);
    });
});
