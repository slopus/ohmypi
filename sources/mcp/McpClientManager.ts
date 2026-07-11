import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { connectMcpServer, type ConnectedMcpServer } from "./connectMcpServer.js";
import { createMcpProtocolTools } from "./createMcpProtocolTools.js";
import { createMcpTool } from "./createMcpTool.js";
import { loadMcpServerConfigs } from "./loadMcpServerConfigs.js";
import type {
    McpServerConfig,
    McpServerSummary,
    McpToolLoadResult,
    McpToolProvider,
} from "./types.js";

interface LoadedConnectionSet extends McpToolLoadResult {
    connections: readonly ConnectedMcpServer[];
}

interface ConnectedServerResult {
    config: McpServerConfig;
    connection: ConnectedMcpServer;
    name: string;
    tools: Awaited<ReturnType<Client["listTools"]>>["tools"];
}

interface FailedServerResult {
    errorMessage: string;
    name: string;
}

type ServerResult = ConnectedServerResult | FailedServerResult;

export interface McpClientManagerOptions {
    env?: NodeJS.ProcessEnv;
    homeDirectory?: string;
}

export class McpClientManager implements McpToolProvider {
    #connectionSets = new Map<string, Promise<LoadedConnectionSet>>();
    #env: NodeJS.ProcessEnv;
    #homeDirectory: string | undefined;

    constructor(options: McpClientManagerOptions = {}) {
        this.#env = options.env ?? process.env;
        this.#homeDirectory = options.homeDirectory;
    }

    async load(cwd: string): Promise<McpToolLoadResult> {
        let pending = this.#connectionSets.get(cwd);
        if (pending === undefined) {
            pending = this.#loadConnectionSet(cwd);
            this.#connectionSets.set(cwd, pending);
        }
        const loaded = await pending;
        return { servers: loaded.servers, tools: loaded.tools };
    }

    async close(): Promise<void> {
        const sets = await Promise.allSettled(this.#connectionSets.values());
        this.#connectionSets.clear();
        await Promise.allSettled(
            sets.flatMap((set) =>
                set.status === "fulfilled"
                    ? set.value.connections.map((connection) => connection.close())
                    : [],
            ),
        );
    }

    async #loadConnectionSet(cwd: string): Promise<LoadedConnectionSet> {
        const configs = await loadMcpServerConfigs(cwd, {
            env: this.#env,
            ...(this.#homeDirectory !== undefined ? { homeDirectory: this.#homeDirectory } : {}),
        });
        const entries = Object.entries(configs).sort(([left], [right]) =>
            left.localeCompare(right),
        );
        const disabledSummaries: McpServerSummary[] = entries
            .filter(([, config]) => config.enabled === false)
            .map(([name]) => ({ name, status: "disabled", toolCount: 0 }));
        const results = await Promise.all(
            entries
                .filter(([, config]) => config.enabled !== false)
                .map(([name, config]) => this.#connectServer(name, config, cwd)),
        );

        const connections: ConnectedMcpServer[] = [];
        const protocolConnections: Array<{
            client: Client;
            disabledTools?: readonly string[];
            enabledTools?: readonly string[];
            name: string;
            timeoutMs?: number;
        }> = [];
        const servers: McpServerSummary[] = [...disabledSummaries];
        const tools: McpToolLoadResult["tools"][number][] = [];
        const toolNames = new Set<string>();
        for (const result of results) {
            if ("errorMessage" in result) {
                servers.push({
                    errorMessage: result.errorMessage,
                    name: result.name,
                    status: "failed",
                    toolCount: 0,
                });
                continue;
            }
            const serverTools = result.tools.map((tool) =>
                createMcpTool({
                    client: result.connection.client,
                    serverName: result.name,
                    tool,
                    ...(result.config.toolTimeoutMs !== undefined
                        ? { timeoutMs: result.config.toolTimeoutMs }
                        : {}),
                }),
            );
            const duplicate = serverTools.find((tool) => toolNames.has(tool.name));
            const duplicateInsideServer =
                new Set(serverTools.map((tool) => tool.name)).size !== serverTools.length;
            if (duplicate !== undefined || duplicateInsideServer) {
                await result.connection.close().catch(() => undefined);
                servers.push({
                    errorMessage: `MCP tool names collide after normalization for server "${result.name}".`,
                    name: result.name,
                    status: "failed",
                    toolCount: 0,
                });
                continue;
            }
            connections.push(result.connection);
            protocolConnections.push({
                client: result.connection.client,
                ...(result.config.disabledTools === undefined
                    ? {}
                    : { disabledTools: result.config.disabledTools }),
                ...(result.config.enabledTools === undefined
                    ? {}
                    : { enabledTools: result.config.enabledTools }),
                name: result.name,
                ...(result.config.toolTimeoutMs === undefined
                    ? {}
                    : { timeoutMs: result.config.toolTimeoutMs }),
            });
            for (const tool of serverTools) {
                toolNames.add(tool.name);
                tools.push(tool);
            }
            servers.push({
                name: result.name,
                promptSupport:
                    result.connection.client.getServerCapabilities()?.prompts !== undefined,
                resourceSupport:
                    result.connection.client.getServerCapabilities()?.resources !== undefined,
                status: "connected",
                toolCount: serverTools.length,
            });
        }

        if (protocolConnections.length > 0) {
            tools.push(...createMcpProtocolTools(protocolConnections));
        }

        servers.sort((left, right) => left.name.localeCompare(right.name));
        return { connections, servers, tools };
    }

    async #connectServer(
        name: string,
        config: McpServerConfig,
        cwd: string,
    ): Promise<ServerResult> {
        let connection: ConnectedMcpServer | undefined;
        try {
            connection = await connectMcpServer(name, config, cwd, this.#env);
            const tools = await listAllTools(connection.client, config.startupTimeoutMs ?? 10_000);
            const enabled =
                config.enabledTools === undefined ? undefined : new Set(config.enabledTools);
            const disabled = new Set(config.disabledTools ?? []);
            return {
                config,
                connection,
                name,
                tools: tools.filter(
                    (tool) =>
                        (enabled === undefined || enabled.has(tool.name)) &&
                        !disabled.has(tool.name),
                ),
            };
        } catch (error) {
            await connection?.close().catch(() => undefined);
            return {
                errorMessage: error instanceof Error ? error.message : String(error),
                name,
            };
        }
    }
}

async function listAllTools(
    client: Client,
    timeout: number,
): Promise<Awaited<ReturnType<Client["listTools"]>>["tools"]> {
    const tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
    let cursor: string | undefined;
    do {
        const page = await client.listTools(cursor === undefined ? undefined : { cursor }, {
            timeout,
        });
        tools.push(...page.tools);
        cursor = page.nextCursor;
    } while (cursor !== undefined);
    return tools;
}
