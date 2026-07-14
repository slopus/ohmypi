import { describe, expect, it } from "vitest";

import { isMcpErrorResult } from "./isMcpErrorResult.js";

describe("isMcpErrorResult", () => {
    it("recognizes only explicit MCP application errors", () => {
        expect(isMcpErrorResult({ isError: true })).toBe(true);
        expect(isMcpErrorResult({ isError: false })).toBe(false);
        expect(isMcpErrorResult({})).toBe(false);
        expect(isMcpErrorResult(null)).toBe(false);
    });
});
