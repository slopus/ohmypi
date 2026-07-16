import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { createMcpTool } from "./createMcpTool.js";

describe("createMcpTool", () => {
    it.each([true, false, undefined])(
        "reviews direct MCP tools when readOnlyHint is %s",
        async (readOnlyHint) => {
            const tool = createMcpTool({
                client: {} as Client,
                serverName: "untrusted server",
                tool: {
                    ...(readOnlyHint === undefined ? {} : { annotations: { readOnlyHint } }),
                    inputSchema: { properties: {}, type: "object" },
                    name: "possibly_mutating_action",
                },
            });

            expect(
                await tool.shouldReviewInAutoMode({} as never, createJustBashToolHarness().context),
            ).toBe(true);
            expect(tool.locks).toEqual(["mcp:untrusted server"]);
        },
    );
});
