import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
            homeDirectory: join(cwd, "empty-home"),
        });
        try {
            const fixture = join(
                dirname(fileURLToPath(import.meta.url)),
                "testing",
                "stdioMcpServer.mjs",
            );
            await mkdir(join(cwd, ".codex"));
            await writeFile(
                join(cwd, ".codex", "config.toml"),
                `[mcp_servers."test server"]\ncommand = "${process.execPath}"\nargs = ["${fixture}"]\n`,
                "utf8",
            );

            const loaded = await manager.load(cwd);

            expect(loaded.servers).toEqual([
                {
                    name: "test server",
                    promptSupport: true,
                    resourceSupport: true,
                    status: "connected",
                    toolCount: 2,
                },
            ]);
            expect(loaded.tools.map((tool) => tool.name)).toEqual([
                "mcp__test_server__echo_value",
                "mcp__test_server__ask_environment",
                "list_mcp_tools",
                "call_mcp_tool",
                "list_mcp_resources",
                "list_mcp_resource_templates",
                "read_mcp_resource",
                "list_mcp_prompts",
                "get_mcp_prompt",
            ]);
            const tool = loaded.tools.find(
                (candidate) => candidate.name === "mcp__test_server__echo_value",
            );
            expect(tool).toBeDefined();
            const harness = createJustBashToolHarness();
            const result = await tool?.execute({ value: "hello" } as never, harness.context, {});
            expect(tool?.toLLM(result as never)).toEqual([{ type: "text", text: "Echo: hello" }]);
            expect(tool?.locks).toEqual([]);

            harness.context.userInput = {
                request: async () => ({ answers: { environment: ["staging"] } }),
            };
            const elicitingTool = loaded.tools.find(
                (candidate) => candidate.name === "mcp__test_server__ask_environment",
            );
            const elicitationResult = await elicitingTool?.execute(
                {} as never,
                harness.context,
                {},
            );
            expect(elicitingTool?.toLLM(elicitationResult as never)).toEqual([
                { type: "text", text: "Selected: staging" },
            ]);

            const readResource = loaded.tools.find(
                (candidate) => candidate.name === "read_mcp_resource",
            );
            const resourceResult = await readResource?.execute(
                { server: "test server", uri: "rig://guide" } as never,
                harness.context,
                {},
            );
            expect(readResource?.toLLM(resourceResult as never)).toEqual([
                { type: "text", text: "Use pnpm." },
            ]);

            const getPrompt = loaded.tools.find((candidate) => candidate.name === "get_mcp_prompt");
            const promptResult = await getPrompt?.execute(
                {
                    server: "test server",
                    name: "review_change",
                    arguments: { focus: "permissions" },
                } as never,
                harness.context,
                {},
            );
            expect(getPrompt?.toLLM(promptResult as never)).toEqual([
                { type: "text", text: expect.stringContaining("Review permissions.") },
            ]);
        } finally {
            await manager.close();
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("keeps an unavailable optional server visible without blocking other tools", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-mcp-client-"));
        const manager = new McpClientManager({
            env: { XDG_CONFIG_HOME: join(cwd, "empty-config") } as NodeJS.ProcessEnv,
            homeDirectory: join(cwd, "empty-home"),
        });
        try {
            await mkdir(join(cwd, ".codex"));
            await writeFile(
                join(cwd, ".codex", "config.toml"),
                '[mcp_servers.missing]\ncommand = "rig-command-that-does-not-exist"\n',
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

    it("enforces tool allowlists through live list and call tools", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-mcp-client-"));
        const manager = new McpClientManager({
            env: { XDG_CONFIG_HOME: join(cwd, "empty-config") } as NodeJS.ProcessEnv,
            homeDirectory: join(cwd, "empty-home"),
        });
        try {
            const fixture = join(
                dirname(fileURLToPath(import.meta.url)),
                "testing",
                "stdioMcpServer.mjs",
            );
            await mkdir(join(cwd, ".codex"));
            await writeFile(
                join(cwd, ".codex", "config.toml"),
                `[mcp_servers.restricted]\ncommand = "${process.execPath}"\nargs = ["${fixture}"]\nenabled_tools = ["echo_value"]\n`,
                "utf8",
            );
            const loaded = await manager.load(cwd);
            const harness = createJustBashToolHarness();
            const listTools = loaded.tools.find((tool) => tool.name === "list_mcp_tools");
            const listResult = await listTools?.execute(
                { server: "restricted" } as never,
                harness.context,
                {},
            );
            expect(listTools?.toLLM(listResult as never)[0]).toEqual({
                type: "text",
                text: expect.not.stringContaining("ask_environment"),
            });

            const callTool = loaded.tools.find((tool) => tool.name === "call_mcp_tool");
            await expect(
                callTool?.execute(
                    { server: "restricted", name: "ask_environment" } as never,
                    harness.context,
                    {},
                ),
            ).rejects.toThrow("disabled by the server policy");
        } finally {
            await manager.close();
            await rm(cwd, { force: true, recursive: true });
        }
    });
});
