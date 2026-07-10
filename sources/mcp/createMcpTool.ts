import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Type } from "@sinclair/typebox";

import { defineTool, type AnyDefinedTool } from "../agent/types.js";
import { mcpResultToContentBlocks } from "./mcpResultToContentBlocks.js";
import { normalizeMcpName } from "./normalizeMcpName.js";

type ListedMcpTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export function createMcpTool(options: {
    client: Client;
    serverName: string;
    tool: ListedMcpTool;
    timeoutMs?: number;
}): AnyDefinedTool {
    const qualifiedName = `mcp__${normalizeMcpName(options.serverName)}__${normalizeMcpName(options.tool.name)}`;
    const tool = defineTool({
        name: qualifiedName,
        label: qualifiedName,
        description:
            options.tool.description ?? `Use ${options.tool.name} from ${options.serverName}.`,
        arguments: Type.Unsafe<Record<string, unknown>>(options.tool.inputSchema),
        returnType: Type.Unknown(),
        async execute(args, _context, execution) {
            const result = await options.client.callTool(
                {
                    arguments: isRecord(args) ? args : {},
                    name: options.tool.name,
                },
                undefined,
                {
                    ...(execution.signal !== undefined ? { signal: execution.signal } : {}),
                    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
                },
            );
            if (result.isError === true) {
                throw new Error(firstText(result) ?? "The MCP tool reported an error.");
            }
            return result;
        },
        toLLM: (result) => mcpResultToContentBlocks(result),
        toUI: () => `${humanizeName(options.serverName)} · ${humanizeName(options.tool.name)}`,
        locks: options.tool.annotations?.readOnlyHint === true ? [] : [`mcp:${options.serverName}`],
    });
    return tool as AnyDefinedTool;
}

function firstText(result: unknown): string | undefined {
    if (!isRecord(result) || !Array.isArray(result.content)) return undefined;
    const text = result.content.find(
        (content): content is { text: string } =>
            isRecord(content) && content.type === "text" && typeof content.text === "string",
    );
    return text?.text;
}

function humanizeName(value: string): string {
    return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
