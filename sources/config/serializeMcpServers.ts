import type { McpServerConfig } from "../mcp/types.js";

export function serializeMcpServers(
    servers: Readonly<Record<string, McpServerConfig>>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(servers).map(([name, server]) => [
            name,
            server.transport === "stdio"
                ? {
                      command: server.command,
                      ...(server.args !== undefined ? { args: server.args } : {}),
                      ...(server.env !== undefined ? { env: server.env } : {}),
                      ...(server.cwd !== undefined ? { cwd: server.cwd } : {}),
                      ...serializeCommonFields(server),
                  }
                : {
                      url: server.url,
                      ...(server.headers !== undefined ? { http_headers: server.headers } : {}),
                      ...(server.bearerTokenEnvVar !== undefined
                          ? { bearer_token_env_var: server.bearerTokenEnvVar }
                          : {}),
                      ...serializeCommonFields(server),
                  },
        ]),
    );
}

function serializeCommonFields(server: McpServerConfig): Record<string, unknown> {
    return {
        ...(server.enabled !== undefined ? { enabled: server.enabled } : {}),
        ...(server.startupTimeoutMs !== undefined
            ? { startup_timeout_sec: server.startupTimeoutMs / 1_000 }
            : {}),
        ...(server.toolTimeoutMs !== undefined
            ? { tool_timeout_sec: server.toolTimeoutMs / 1_000 }
            : {}),
        ...(server.enabledTools !== undefined ? { enabled_tools: server.enabledTools } : {}),
        ...(server.disabledTools !== undefined ? { disabled_tools: server.disabledTools } : {}),
    };
}
