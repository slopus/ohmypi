import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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

server.registerTool(
    "ask_environment",
    { description: "Ask which environment to use." },
    async () => {
        const result = await server.server.elicitInput({
            message: "Choose an environment.",
            requestedSchema: {
                type: "object",
                properties: {
                    environment: {
                        type: "string",
                        title: "Environment",
                        enum: ["staging", "production"],
                    },
                },
                required: ["environment"],
            },
        });
        return {
            content: [
                {
                    type: "text",
                    text: `Selected: ${result.content?.environment ?? result.action}`,
                },
            ],
        };
    },
);

server.registerResource(
    "project guide",
    "rig://guide",
    { description: "A test project guide.", mimeType: "text/plain" },
    async () => ({ contents: [{ uri: "rig://guide", text: "Use pnpm." }] }),
);

server.registerResource(
    "named guide",
    new ResourceTemplate("rig://guide/{name}", { list: undefined }),
    { description: "A named project guide.", mimeType: "text/plain" },
    async (uri, { name }) => ({ contents: [{ uri: uri.href, text: `Guide for ${name}.` }] }),
);

server.registerPrompt(
    "review_change",
    { argsSchema: { focus: z.string() }, description: "Review a change." },
    async ({ focus }) => ({
        messages: [{ role: "user", content: { type: "text", text: `Review ${focus}.` } }],
    }),
);

await server.connect(new StdioServerTransport());
