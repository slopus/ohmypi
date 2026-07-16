import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { defineTool } from "../agent/types.js";
import { mergeMcpTools } from "./mergeMcpTools.js";

describe("mergeMcpTools", () => {
    it("quarantines a conflicting server without dropping other MCP tools", () => {
        const existing = tool("mcp__docs__search");
        const result = mergeMcpTools([existing], {
            servers: [
                { name: "docs", status: "connected", toolCount: 2 },
                { name: "issues", status: "connected", toolCount: 1 },
            ],
            tools: [
                tool("mcp__docs__search"),
                tool("mcp__docs__read"),
                tool("mcp__issues__create"),
            ],
        });

        expect(result.tools.map((candidate) => candidate.name)).toEqual([
            "mcp__docs__search",
            "mcp__issues__create",
        ]);
        expect(result.servers).toEqual([
            {
                errorMessage: "Tool name conflict: mcp__docs__search",
                name: "docs",
                status: "failed",
                toolCount: 0,
            },
            { name: "issues", status: "connected", toolCount: 1 },
        ]);
    });
});

function tool(name: string) {
    return defineTool({
        name,
        label: name,
        description: "Test tool.",
        arguments: Type.Object({}),
        returnType: Type.Unknown(),
        shouldReviewInAutoMode: () => false,
        execute: () => undefined,
        toLLM: () => [],
        toUI: () => name,
        locks: [],
    });
}
