import { describe, expect, it } from "vitest";

import { promptImageOutputDimensions } from "./promptImageOutputDimensions.js";

describe("promptImageOutputDimensions", () => {
    it("matches the Codex high-detail patch budget", () => {
        expect(
            promptImageOutputDimensions(2048, 2048, {
                maxDimension: 2048,
                maxPatches: 2_500,
            }),
        ).toEqual({ width: 1600, height: 1600 });
    });

    it("constrains dimensions without changing the aspect ratio materially", () => {
        expect(
            promptImageOutputDimensions(3000, 1000, {
                maxDimension: 2048,
                maxPatches: 2_500,
            }),
        ).toEqual({ width: 2048, height: 683 });
    });

    it("preserves images already inside the limit", () => {
        expect(
            promptImageOutputDimensions(32, 32, {
                maxDimension: 2048,
                maxPatches: 2_500,
            }),
        ).toEqual({ width: 32, height: 32 });
    });
});
