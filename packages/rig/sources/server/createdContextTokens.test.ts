import { describe, expect, it } from "vitest";

import { createdContextTokens } from "./createdContextTokens.js";

describe("createdContextTokens", () => {
    it("excludes cache reads from the context-sized token contribution", () => {
        expect(
            createdContextTokens({
                cacheRead: 900,
                cacheWrite: 0,
                cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
                input: 1_000,
                output: 250,
                totalTokens: 1_250,
            }),
        ).toBe(350);
    });
});
