import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { McpClientManager } from "./McpClientManager.js";

describe("McpClientManager", () => {
    it("discovers and calls tools over a stdio MCP connection", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-mcp-client-"));
        const manager = new McpClientManager({
            env: { XDG_CONFIG_HOME: join(cwd, "empty-config") } as NodeJS.ProcessEnv,
        });
        try {
            const fixture = join(
                dirname(fileURLToPath(import.meta.url)),
                "testing",
                "stdioMcpServer.mjs",
            );
            await writeFile(
                join(cwd, ".mcp.json"),
                JSON.stringify({
                    mcpServers: {
                        "test server": {
                            command: process.execPath,
                            args: [fixture],
                        },
                    },
                }),
                "utf8",
            );

            const loaded = await manager.load(cwd);

            expect(loaded.servers).toEqual([
                { name: "test server", status: "connected", toolCount: 1 },
            ]);
            expect(loaded.tools.map((tool) => tool.name)).toEqual(["mcp__test_server__echo_value"]);
            const tool = loaded.tools[0];
            expect(tool).toBeDefined();
            const harness = createJustBashToolHarness();
            const result = await tool?.execute({ value: "hello" } as never, harness.context, {});
            expect(tool?.toLLM(result as never)).toEqual([{ type: "text", text: "Echo: hello" }]);
            expect(tool?.locks).toEqual([]);
        } finally {
            await manager.close();
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("keeps an unavailable optional server visible without blocking other tools", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-mcp-client-"));
        const manager = new McpClientManager({
            env: { XDG_CONFIG_HOME: join(cwd, "empty-config") } as NodeJS.ProcessEnv,
        });
        try {
            await writeFile(
                join(cwd, ".mcp.json"),
                JSON.stringify({
                    mcpServers: { missing: { command: "rig-command-that-does-not-exist" } },
                }),
                "utf8",
            );

            const loaded = await manager.load(cwd);

            expect(loaded.tools).toEqual([]);
            expect(loaded.servers).toEqual([
                expect.objectContaining({
                    name: "missing",
                    status: "failed",
                    toolCount: 0,
                }),
            ]);
            expect(loaded.servers[0]?.errorMessage).toContain("could not connect");
        } finally {
            await manager.close();
            await rm(cwd, { force: true, recursive: true });
        }
    });
});
