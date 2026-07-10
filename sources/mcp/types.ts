import type { AnyDefinedTool } from "../agent/index.js";

export interface McpServerConfigBase {
    disabledTools?: readonly string[];
    enabled?: boolean;
    enabledTools?: readonly string[];
    startupTimeoutMs?: number;
    toolTimeoutMs?: number;
}

export interface McpStdioServerConfig extends McpServerConfigBase {
    args?: readonly string[];
    command: string;
    cwd?: string;
    env?: Readonly<Record<string, string>>;
    transport: "stdio";
}

export interface McpHttpServerConfig extends McpServerConfigBase {
    bearerTokenEnvVar?: string;
    headers?: Readonly<Record<string, string>>;
    transport: "http";
    url: string;
}

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export interface McpServerSummary {
    errorMessage?: string;
    name: string;
    status: "connected" | "disabled" | "failed";
    toolCount: number;
}

export interface McpToolLoadResult {
    servers: readonly McpServerSummary[];
    tools: readonly AnyDefinedTool[];
}

export interface McpToolProvider {
    close(): Promise<void>;
    load(cwd: string): Promise<McpToolLoadResult>;
}
