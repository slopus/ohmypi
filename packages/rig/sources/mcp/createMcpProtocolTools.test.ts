import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { createMcpProtocolTools } from "./createMcpProtocolTools.js";

describe("createMcpProtocolTools", () => {
    it("makes the dynamic call tool own its external-boundary description", () => {
        const tool = createMcpProtocolTools([
            { client: {} as Client, name: "deployment_service" },
        ]).find((candidate) => candidate.name === "call_mcp_tool");
        const describe = tool?.describeAutoPermissionAction;

        expect(describe).toBeDefined();
        expect(
            describe?.(
                {
                    arguments: { channel: "production" },
                    name: "publish_release",
                    server: "deployment_service",
                } as never,
                createJustBashToolHarness().context,
            ),
        ).toBe(
            'calling "Publish Release" from "Deployment Service" with arguments "{\\"channel\\":\\"production\\"}". Access: the MCP server can perform actions outside Rig’s filesystem sandbox',
        );
    });
});
