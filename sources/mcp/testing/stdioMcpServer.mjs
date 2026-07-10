import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const server = new McpServer({ name: "rig-test-server", version: "1.0.0" });

server.registerTool(
    "echo_value",
    {
        annotations: { readOnlyHint: true },
        description: "Echo a value from the test MCP server.",
        inputSchema: { value: z.string() },
    },
    async ({ value }) => ({ content: [{ type: "text", text: `Echo: ${value}` }] }),
);

await server.connect(new StdioServerTransport());
