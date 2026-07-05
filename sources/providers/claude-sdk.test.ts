import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { defineTool } from "../agent/types.js";
import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { modelAnthropicFable5, modelAnthropicOpus48, modelAnthropicSonnet5 } from "./models.js";
import { createClaudeSdkProvider, type ClaudeSdkQuery } from "./claude-sdk.js";
import type { Context } from "./types.js";

describe("Claude SDK provider", () => {
    it("runs Claude Agent SDK with built-in tools disabled and project tools exposed", async () => {
        const harness = createJustBashToolHarness();
        const calls: Parameters<ClaudeSdkQuery>[0][] = [];
        const provider = createClaudeSdkProvider({
            agentContext: harness.context,
            tools: [
                defineTool({
                    name: "Read",
                    label: "Read",
                    description: "Read a file through the project tool.",
                    arguments: Type.Object({
                        path: Type.String({ description: "Path to read." }),
                    }),
                    returnType: Type.Object({
                        text: Type.String(),
                    }),
                    execute: async ({ path }) => ({ text: `read ${path}` }),
                    toLLM: (result) => [{ type: "text", text: result.text }],
                    toUI: (result) => result.text,
                    locks: [],
                }),
            ],
            query: ((params) => {
                calls.push(params);
                return fakeClaudeQuery([
                    {
                        type: "result",
                        subtype: "success",
                        duration_ms: 1,
                        duration_api_ms: 1,
                        is_error: false,
                        num_turns: 1,
                        result: "ok",
                        stop_reason: "end_turn",
                        total_cost_usd: 0,
                        usage: {
                            input_tokens: 2,
                            output_tokens: 1,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0,
                            server_tool_use: null,
                            service_tier: null,
                            cache_creation: null,
                        },
                        modelUsage: {},
                        permission_denials: [],
                        uuid: "00000000-0000-4000-8000-000000000001",
                        session_id: "00000000-0000-4000-8000-000000000002",
                    },
                ]);
            }) as ClaudeSdkQuery,
        });
        const context: Context = {
            systemPrompt: "Use project tools.",
            messages: [
                {
                    role: "user",
                    content: "Say ok.",
                    timestamp: 1,
                },
            ],
        };

        const stream = provider.stream(modelAnthropicFable5, context);
        for await (const _event of stream) {
            // Drain the stream.
        }
        const result = await stream.result();

        expect(result.content).toEqual([{ type: "text", text: "ok" }]);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.options?.tools).toEqual([]);
        expect(calls[0]?.options?.allowedTools).toEqual(["mcp__ohmypi__Read"]);
        expect(calls[0]?.options?.toolAliases).toBeUndefined();
        expect(calls[0]?.options?.extraArgs).toEqual({ "disable-slash-commands": null });
        expect(calls[0]?.options?.env?.CLAUDE_CODE_DISABLE_BUNDLED_SKILLS).toBe("1");
        expect(calls[0]?.options?.env?.CLAUDE_AGENT_SDK_MCP_NO_PREFIX).toBe("1");
        expect(calls[0]?.options?.permissionMode).toBe("dontAsk");
        expect(calls[0]?.options?.persistSession).toBe(false);
        expect(calls[0]?.options?.settingSources).toEqual([]);
        expect(calls[0]?.options?.strictMcpConfig).toBe(true);
        expect(calls[0]?.options?.mcpServers).toHaveProperty("ohmypi");
    });

    it("maps latest Anthropic catalog models and reasoning effort to Claude SDK options", async () => {
        const harness = createJustBashToolHarness();
        const calls: Parameters<ClaudeSdkQuery>[0][] = [];
        const provider = createClaudeSdkProvider({
            agentContext: harness.context,
            tools: [],
            query: ((params) => {
                calls.push(params);
                return fakeClaudeQuery([
                    {
                        type: "result",
                        subtype: "success",
                        duration_ms: 1,
                        duration_api_ms: 1,
                        is_error: false,
                        num_turns: 1,
                        result: "ok",
                        stop_reason: "end_turn",
                        total_cost_usd: 0,
                        usage: {
                            input_tokens: 1,
                            output_tokens: 1,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0,
                            server_tool_use: null,
                            service_tier: null,
                            cache_creation: null,
                        },
                        modelUsage: {},
                        permission_denials: [],
                        uuid: "00000000-0000-4000-8000-000000000005",
                        session_id: "00000000-0000-4000-8000-000000000006",
                    },
                ]);
            }) as ClaudeSdkQuery,
        });

        await provider
            .stream(
                modelAnthropicSonnet5,
                { messages: [{ role: "user", content: "Say ok.", timestamp: 1 }] },
                { thinking: "xhigh" },
            )
            .result();
        await provider
            .stream(modelAnthropicOpus48, {
                messages: [{ role: "user", content: "Say ok.", timestamp: 2 }],
            })
            .result();
        await provider
            .stream(modelAnthropicFable5, {
                messages: [{ role: "user", content: "Say ok.", timestamp: 3 }],
            })
            .result();

        expect(calls[0]?.options?.model).toBe("sonnet");
        expect(calls[0]?.options?.effort).toBe("xhigh");
        expect(calls[0]?.options?.thinking).toEqual({ type: "adaptive" });
        expect(calls[1]?.options?.model).toBe("opus[1m]");
        expect(calls[2]?.options?.model).toBe("claude-fable-5[1m]");
    });

    it("resolves a result when callers do not consume stream events", async () => {
        const harness = createJustBashToolHarness();
        const provider = createClaudeSdkProvider({
            agentContext: harness.context,
            tools: [],
            query: (() =>
                fakeClaudeQuery([
                    {
                        type: "result",
                        subtype: "success",
                        duration_ms: 1,
                        duration_api_ms: 1,
                        is_error: false,
                        num_turns: 1,
                        result: "done",
                        stop_reason: "end_turn",
                        total_cost_usd: 0,
                        usage: {
                            input_tokens: 1,
                            output_tokens: 1,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0,
                            server_tool_use: null,
                            service_tier: null,
                            cache_creation: null,
                        },
                        modelUsage: {},
                        permission_denials: [],
                        uuid: "00000000-0000-4000-8000-000000000003",
                        session_id: "00000000-0000-4000-8000-000000000004",
                    },
                ])) as ClaudeSdkQuery,
        });

        const result = await provider
            .stream(modelAnthropicFable5, {
                messages: [{ role: "user", content: "Finish.", timestamp: 1 }],
            })
            .result();

        expect(result.content).toEqual([{ type: "text", text: "done" }]);
    });
});

function fakeClaudeQuery(messages: readonly unknown[]) {
    const stream = (async function* () {
        for (const message of messages) {
            yield message;
        }
    })();

    return Object.assign(stream, {
        interrupt: async () => {},
        setPermissionMode: async () => {},
        setMcpPermissionModeOverride: async () => ({}),
        setModel: async () => {},
        setMaxThinkingTokens: async () => {},
        applyFlagSettings: async () => {},
        initializationResult: async () => ({}) as never,
        reinitialize: async () => ({}) as never,
        supportedCommands: async () => [],
        supportedModels: async () => [],
        supportedAgents: async () => [],
        mcpServerStatus: async () => [],
        getContextUsage: async () => ({}) as never,
        usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: async () => ({}) as never,
        readFile: async () => null,
        reloadPlugins: async () => ({}) as never,
        reloadSkills: async () => ({}) as never,
        accountInfo: async () => ({}),
        rewindFiles: async () => ({}) as never,
        seedReadState: async () => {},
        reconnectMcpServer: async () => {},
        toggleMcpServer: async () => {},
        setMcpServers: async () => ({ added: [], removed: [], errors: {} }),
        streamInput: async () => {},
        stopTask: async () => {},
        backgroundTasks: async () => false,
        close: () => {},
    });
}
