import { describe, expect, it } from "vitest";

import { mcpResultToContentBlocks } from "./mcpResultToContentBlocks.js";

describe("mcpResultToContentBlocks", () => {
    it("represents a successful empty result explicitly", () => {
        expect(mcpResultToContentBlocks({ content: [] })).toEqual([
            { type: "text", text: "(empty result)" },
        ]);
    });
});
