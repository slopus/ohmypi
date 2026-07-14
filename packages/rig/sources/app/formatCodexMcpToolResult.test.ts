import { describe, expect, it } from "vitest";

import { formatCodexMcpToolResult } from "./formatCodexMcpToolResult.js";

describe("formatCodexMcpToolResult", () => {
    it("preserves separate text blocks and describes image results", () => {
        expect(
            formatCodexMcpToolResult([
                { type: "text", text: "first" },
                { type: "text", text: "second\nline" },
                { type: "image", data: "base64", mediaType: "image/png" },
            ]),
        ).toEqual(["first", "second\nline", "Image result (image/png)."]);
    });

    it("handles empty and unavailable results", () => {
        expect(formatCodexMcpToolResult([{ type: "text", text: "" }])).toBe("(empty result)");
        expect(formatCodexMcpToolResult([])).toBeUndefined();
        expect(formatCodexMcpToolResult(undefined)).toBeUndefined();
    });
});
