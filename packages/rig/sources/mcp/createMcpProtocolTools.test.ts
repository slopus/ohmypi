import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { createMcpProtocolTools } from "./createMcpProtocolTools.js";
import { createMcpTool } from "./createMcpTool.js";

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

    it("shares per-server locks with direct MCP tools without locking other servers", () => {
        const client = {} as Client;
        const dynamicTool = createMcpProtocolTools([
            { client, name: "deployment_service" },
            { client, name: "issue_tracker" },
        ]).find((candidate) => candidate.name === "call_mcp_tool");
        const directTool = createMcpTool({
            client,
            serverName: "deployment_service",
            tool: {
                inputSchema: { properties: {}, type: "object" },
                name: "publish_release",
            },
        });
        const dynamicLock = dynamicTool?.locks[0];

        expect(typeof dynamicLock).toBe("function");
        if (typeof dynamicLock !== "function")
            throw new Error("Expected an argument-derived lock.");
        expect(
            dynamicLock({
                arguments: {},
                name: "publish_release",
                server: "deployment_service",
            } as never),
        ).toBe(directTool.locks[0]);
        expect(
            dynamicLock({ arguments: {}, name: "create_issue", server: "issue_tracker" } as never),
        ).not.toBe(directTool.locks[0]);
    });
});
