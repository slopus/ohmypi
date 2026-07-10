import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { McpServerConfig } from "./types.js";

export interface ConnectedMcpServer {
    client: Client;
    close(): Promise<void>;
}

export async function connectMcpServer(
    name: string,
    config: McpServerConfig,
    cwd: string,
    env: NodeJS.ProcessEnv = process.env,
): Promise<ConnectedMcpServer> {
    const client = new Client({ name: "rig", version: "0.0.4" });
    const transport = createTransport(config, cwd, env);
    try {
        await client.connect(transport, { timeout: config.startupTimeoutMs ?? 10_000 });
    } catch (error) {
        await transport.close().catch(() => undefined);
        throw new Error(
            `MCP server "${name}" could not connect: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    return {
        client,
        close: () => client.close(),
    };
}

function createTransport(config: McpServerConfig, cwd: string, env: NodeJS.ProcessEnv): Transport {
    if (config.transport === "stdio") {
        return new StdioClientTransport({
            args: [...(config.args ?? [])],
            command: config.command,
            cwd: config.cwd === undefined ? cwd : resolve(cwd, config.cwd),
            env: {
                ...stringEnvironment(env),
                ...config.env,
            },
            stderr: "ignore",
        });
    }

    const headers = new Headers(config.headers);
    if (config.bearerTokenEnvVar !== undefined) {
        const token = env[config.bearerTokenEnvVar];
        if (token === undefined || token === "") {
            throw new Error(
                `MCP bearer token environment variable "${config.bearerTokenEnvVar}" is not set.`,
            );
        }
        headers.set("Authorization", `Bearer ${token}`);
    }
    return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers },
    }) as unknown as Transport;
}

function stringEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
    return Object.fromEntries(
        Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
}
