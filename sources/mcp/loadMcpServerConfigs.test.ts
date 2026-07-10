import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMcpServerConfigs } from "./loadMcpServerConfigs.js";

describe("loadMcpServerConfigs", () => {
    it("merges Codex-style TOML with Claude-style project configuration", async () => {
        const root = await mkdtemp(join(tmpdir(), "rig-mcp-config-"));
        try {
            const cwd = join(root, "repo");
            const configHome = join(root, "config-home");
            await mkdir(join(configHome, "rig"), { recursive: true });
            await mkdir(cwd, { recursive: true });
            await writeFile(
                join(configHome, "rig", "config.toml"),
                `
[mcp_servers.docs]
command = "docs-server"
args = ["--stdio"]
enabled_tools = ["search"]
tool_timeout_sec = 12
`,
                "utf8",
            );
            await writeFile(
                join(cwd, "rig.toml"),
                `
[mcp_servers.remote]
url = "https://example.com/mcp"
http_headers = { "X-Client" = "rig" }
`,
                "utf8",
            );
            await writeFile(
                join(cwd, ".mcp.json"),
                JSON.stringify({
                    mcpServers: {
                        docs: {
                            type: "stdio",
                            command: "project-docs",
                            args: ["serve"],
                            env: { MODE: "test" },
                        },
                    },
                }),
                "utf8",
            );

            await expect(
                loadMcpServerConfigs(cwd, {
                    env: { XDG_CONFIG_HOME: configHome } as NodeJS.ProcessEnv,
                }),
            ).resolves.toEqual({
                docs: {
                    args: ["serve"],
                    command: "project-docs",
                    env: { MODE: "test" },
                    transport: "stdio",
                },
                remote: {
                    headers: { "X-Client": "rig" },
                    transport: "http",
                    url: "https://example.com/mcp",
                },
            });
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it("reports unsupported project transports clearly", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-mcp-config-"));
        try {
            await writeFile(
                join(cwd, ".mcp.json"),
                JSON.stringify({
                    mcpServers: { legacy: { type: "sse", url: "https://example.com/sse" } },
                }),
                "utf8",
            );
            await expect(loadMcpServerConfigs(cwd)).rejects.toThrow('unsupported transport "sse"');
        } finally {
            await rm(cwd, { force: true, recursive: true });
        }
    });
});
