import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";

import { APIError } from "@anthropic-ai/sdk/error";
import { describe, expect, it } from "vitest";

import { committedSessionEvents } from "@/core/committedSessionEvents.js";
import type { SessionEvent } from "@/core/SessionEvent.js";
import { BedrockBearerTokenCredential } from "@/vendors/bedrock/BedrockBearerTokenCredential.js";
import {
    AnthropicBedrockProvider,
    type AnthropicBedrockProviderOptions,
} from "@/vendors/bedrock/AnthropicBedrockProvider.js";
import { resolveAnthropicBedrockRetryDelay } from "@/vendors/bedrock/impl/anthropicBedrockRetry.js";
import { classifyAnthropicBedrockError } from "@/vendors/bedrock/impl/classifyAnthropicBedrockError.js";
import { createAnthropicBedrockRequest } from "@/vendors/bedrock/impl/createAnthropicBedrockRequest.js";
import { mapAnthropicBedrockStream } from "@/vendors/bedrock/impl/mapAnthropicBedrockStream.js";
import {
    encodeAnthropicReasoningBlocks,
    toAnthropicBedrockMessages,
} from "@/vendors/bedrock/impl/toAnthropicBedrockMessages.js";
import { resolveAnthropicBedrockModelId } from "@/vendors/bedrock/impl/resolveAnthropicBedrockModelId.js";
import { claude_tools } from "@/vendors/claude/tools/index.js";

describe("AnthropicBedrockProvider", () => {
    it("uses the same regional inference profiles as Rig's Bedrock catalog", () => {
        expect(resolveAnthropicBedrockModelId("anthropic/opus-4-8", "us-east-1")).toBe(
            "us.anthropic.claude-opus-4-8",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-4-8", "eu-west-1")).toBe(
            "eu.anthropic.claude-opus-4-8",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-4-8", "ap-southeast-2")).toBe(
            "au.anthropic.claude-opus-4-8",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-5", "us-east-1")).toBe(
            "us.anthropic.claude-opus-5",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-5", "eu-west-1")).toBe(
            "eu.anthropic.claude-opus-5",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-5", "ap-northeast-1")).toBe(
            "jp.anthropic.claude-opus-5",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/opus-5", "eu-west-1", "mantle")).toBe(
            "anthropic.claude-opus-5",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/sonnet-5", "eu-west-1")).toBe(
            "eu.anthropic.claude-sonnet-5",
        );
        expect(resolveAnthropicBedrockModelId("anthropic/sonnet-5", "eu-west-1", "mantle")).toBe(
            "anthropic.claude-sonnet-5",
        );
        expect(resolveAnthropicBedrockModelId("custom-bedrock-profile", "us-east-1")).toBe(
            "custom-bedrock-profile",
        );
        expect(() => resolveAnthropicBedrockModelId("anthropic/opus-4-6", "us-east-1")).toThrow(
            'Anthropic model "anthropic/opus-4-6" is not available through Rig\'s Bedrock catalog.',
        );
    });

    it("uses native server-side compaction and preserves its replay metadata", async () => {
        const capturedRequests: Record<string, unknown>[] = [];
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-compaction-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async (request: Record<string, unknown>) => {
                        capturedRequests.push(request);
                        if (capturedRequests.length === 2) {
                            return streamEvents([
                                {
                                    type: "message_start",
                                    message: { usage: { input_tokens: 10, output_tokens: 0 } },
                                },
                                {
                                    type: "content_block_start",
                                    index: 0,
                                    content_block: { type: "text", text: "" },
                                },
                                {
                                    type: "content_block_delta",
                                    index: 0,
                                    delta: { type: "text_delta", text: "continued" },
                                },
                                { type: "content_block_stop", index: 0 },
                                {
                                    type: "message_delta",
                                    delta: { stop_reason: "end_turn", stop_sequence: null },
                                    usage: { output_tokens: 1 },
                                },
                                { type: "message_stop" },
                            ]);
                        }
                        return streamEvents([
                            {
                                type: "message_start",
                                message: {
                                    usage: {
                                        input_tokens: 0,
                                        output_tokens: 0,
                                        cache_read_input_tokens: 0,
                                        cache_creation_input_tokens: 0,
                                        iterations: null,
                                    },
                                },
                            },
                            {
                                type: "content_block_start",
                                index: 0,
                                content_block: {
                                    type: "compaction",
                                    content: null,
                                    encrypted_content: null,
                                },
                            },
                            {
                                type: "content_block_delta",
                                index: 0,
                                delta: {
                                    type: "compaction_delta",
                                    content: "Native ",
                                    encrypted_content: null,
                                },
                            },
                            {
                                type: "content_block_delta",
                                index: 0,
                                delta: {
                                    type: "compaction_delta",
                                    content: "summary",
                                    encrypted_content: "opaque-compaction-metadata",
                                },
                            },
                            { type: "content_block_stop", index: 0 },
                            {
                                type: "message_delta",
                                delta: {
                                    stop_reason: "compaction",
                                    stop_sequence: null,
                                },
                                usage: {
                                    input_tokens: 0,
                                    output_tokens: 0,
                                    cache_read_input_tokens: 0,
                                    cache_creation_input_tokens: 0,
                                    iterations: [
                                        {
                                            type: "compaction",
                                            input_tokens: 60_000,
                                            output_tokens: 1_500,
                                            cache_read_input_tokens: 10_000,
                                            cache_creation_input_tokens: 500,
                                            cache_creation: null,
                                        },
                                    ],
                                },
                            },
                            { type: "message_stop" },
                        ]);
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: {
                instructions: "system",
                messages: [{ role: "user", content: "long conversation" }],
            },
            tools: [],
        });

        const result = await session.compact({
            context: {
                messages: [{ role: "user", content: "prefix selected for compaction" }],
            },
            inputTokens: 60_000,
            instructions: "Preserve identifiers.",
        });

        expect(capturedRequests[0]).toMatchObject({
            betas: expect.arrayContaining(["compact-2026-01-12"]),
            context_management: {
                edits: [
                    {
                        type: "compact_20260112",
                        instructions: expect.stringContaining("Preserve identifiers."),
                        pause_after_compaction: true,
                        trigger: { type: "input_tokens", value: 50_000 },
                    },
                ],
            },
            model: "anthropic.claude-opus-4-8",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "prefix selected for compaction",
                            cache_control: { type: "ephemeral" },
                        },
                    ],
                },
            ],
        });
        expect(result).toMatchObject({
            status: "completed",
            compaction: {
                role: "compaction",
                content: "Native summary",
                vendor: {
                    type: "anthropic_compaction",
                    encryptedContent: "opaque-compaction-metadata",
                },
            },
            usage: {
                input: 60_000,
                output: 1_500,
                cacheRead: 10_000,
                cacheWrite: 500,
                totalTokens: 72_000,
            },
            preservedMessages: [],
            context: {
                messages: [
                    {
                        role: "compaction",
                        content: "Native summary",
                    },
                ],
            },
        });
        if (result.status !== "completed" || result.compaction === undefined) {
            throw new Error("Expected native Anthropic Bedrock compaction.");
        }
        expect(toAnthropicBedrockMessages([result.compaction])).toEqual([
            {
                role: "assistant",
                content: [
                    {
                        type: "compaction",
                        content: "Native summary",
                        encrypted_content: "opaque-compaction-metadata",
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
        ]);

        for await (const _event of session.run({
            context: {
                messages: [
                    {
                        role: "user",
                        content: "<conversation_summary>\nNative summary\n</conversation_summary>",
                        input: [
                            {
                                type: "text",
                                text: "<conversation_summary>\nNative summary\n</conversation_summary>",
                            },
                        ],
                    },
                    { role: "user", content: "retained turn" },
                ],
            },
        })) {
            // Consume the continuation so its wire request is captured.
        }

        expect(capturedRequests[1]?.messages).toEqual([
            {
                role: "assistant",
                content: [
                    {
                        type: "compaction",
                        content: "Native summary",
                        encrypted_content: "opaque-compaction-metadata",
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "retained turn",
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
        ]);

        await session.compact({
            context: {
                messages: [
                    {
                        role: "user",
                        content: "<conversation_summary>\nNative summary\n</conversation_summary>",
                        input: [
                            {
                                type: "text",
                                text: "<conversation_summary>\nNative summary\n</conversation_summary>",
                            },
                        ],
                    },
                    { role: "user", content: "retained turn" },
                ],
            },
            inputTokens: 60_000,
        });

        expect(capturedRequests[2]?.messages).toEqual([
            {
                role: "assistant",
                content: [
                    {
                        type: "compaction",
                        content: "Native summary",
                        encrypted_content: "opaque-compaction-metadata",
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "retained turn",
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
        ]);
    });

    it("uses one summary request instead of probing native compaction below its trigger", async () => {
        const capturedRequests: Record<string, unknown>[] = [];
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-small-compaction-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async (request: Record<string, unknown>) => {
                        capturedRequests.push(request);
                        return streamEvents([
                            {
                                type: "message_start",
                                message: { usage: { input_tokens: 1_000, output_tokens: 0 } },
                            },
                            {
                                type: "content_block_start",
                                index: 0,
                                content_block: { type: "text", text: "" },
                            },
                            {
                                type: "content_block_delta",
                                index: 0,
                                delta: { type: "text_delta", text: "Fallback summary" },
                            },
                            { type: "content_block_stop", index: 0 },
                            {
                                type: "message_delta",
                                delta: { stop_reason: "end_turn", stop_sequence: null },
                                usage: { output_tokens: 2 },
                            },
                            { type: "message_stop" },
                        ]);
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: {
                instructions: "system",
                messages: [{ role: "user", content: "short conversation" }],
            },
            tools: [],
        });

        const result = await session.compact({
            context: {
                messages: [{ role: "user", content: "selected short prefix" }],
            },
            inputTokens: 49_999,
        });

        expect(capturedRequests).toHaveLength(1);
        expect(capturedRequests[0]).not.toHaveProperty("context_management");
        expect(capturedRequests[0]?.messages).toMatchObject([
            {
                role: "user",
                content: "selected short prefix",
            },
            {
                role: "user",
                content: [{ type: "text", text: expect.stringContaining("Summarize") }],
            },
        ]);
        expect(result).toMatchObject({
            status: "completed",
            summary: "Fallback summary",
        });
    });

    it("includes native attempt usage when a missing checkpoint falls back to a summary", async () => {
        const capturedRequests: Record<string, unknown>[] = [];
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-compaction-fallback-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async (request: Record<string, unknown>) => {
                        capturedRequests.push(request);
                        if (capturedRequests.length === 1) {
                            return streamEvents([
                                {
                                    type: "message_start",
                                    message: { usage: { input_tokens: 40, output_tokens: 0 } },
                                },
                                {
                                    type: "content_block_start",
                                    index: 0,
                                    content_block: { type: "text", text: "" },
                                },
                                { type: "content_block_stop", index: 0 },
                                {
                                    type: "message_delta",
                                    delta: { stop_reason: "end_turn", stop_sequence: null },
                                    usage: { output_tokens: 5 },
                                },
                                { type: "message_stop" },
                            ]);
                        }
                        return streamEvents([
                            {
                                type: "message_start",
                                message: { usage: { input_tokens: 10, output_tokens: 0 } },
                            },
                            {
                                type: "content_block_start",
                                index: 0,
                                content_block: { type: "text", text: "" },
                            },
                            {
                                type: "content_block_delta",
                                index: 0,
                                delta: { type: "text_delta", text: "Fallback summary" },
                            },
                            { type: "content_block_stop", index: 0 },
                            {
                                type: "message_delta",
                                delta: { stop_reason: "end_turn", stop_sequence: null },
                                usage: { output_tokens: 2 },
                            },
                            { type: "message_stop" },
                        ]);
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: {
                instructions: "system",
                messages: [{ role: "user", content: "long conversation" }],
            },
            tools: [],
        });

        const result = await session.compact({ inputTokens: 50_000 });

        expect(capturedRequests).toHaveLength(2);
        expect(capturedRequests[0]).toHaveProperty("context_management");
        expect(capturedRequests[1]).not.toHaveProperty("context_management");
        expect(result).toMatchObject({
            status: "completed",
            summary: "Fallback summary",
            usage: {
                input: 50,
                output: 7,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 57,
            },
        });
    });

    it("omits the system field when every system prompt source is empty", () => {
        const request = createAnthropicBedrockRequest({
            context: {
                instructions: "",
                messages: [{ role: "user", content: "hello" }],
            },
            model: "us.anthropic.claude-opus-4-8",
            skills: [],
            tools: [],
        });

        expect(request).not.toHaveProperty("system");
    });

    it("disables thinking without sending a conflicting effort", () => {
        const request = createAnthropicBedrockRequest({
            context: {
                instructions: "system",
                messages: [{ role: "user", content: "hello" }],
            },
            effort: "off",
            model: "us.anthropic.claude-opus-4-8",
            skills: [],
            tools: [],
        });

        expect(request.thinking).toEqual({ type: "disabled" });
        expect(request).not.toHaveProperty("output_config");
    });

    it("uses the executor's assembled model prompt without adding a second Claude prompt", async () => {
        let capturedRequest: Record<string, unknown> | undefined;
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-model-configuration-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async (request: Record<string, unknown>) => {
                        capturedRequest = request;
                        return streamEvents([
                            {
                                type: "message_start",
                                message: { usage: { input_tokens: 1, output_tokens: 0 } },
                            },
                            {
                                type: "message_delta",
                                delta: { stop_reason: "end_turn", stop_sequence: null },
                                usage: { output_tokens: 0 },
                            },
                            { type: "message_stop" },
                        ]);
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: {
                instructions: "unconfigured instructions",
                messages: [{ role: "system", content: "configured system message" }],
            },
            modelConfigurations: {
                "anthropic/opus-4-8": {
                    context: {
                        instructions: "assembled executor prompt",
                        messages: [{ role: "system", content: "configured system message" }],
                    },
                    tools: [],
                },
            },
            tools: [],
        });

        for await (const _event of session.run({
            context: {
                messages: [
                    { role: "system", content: "configured system message" },
                    { role: "user", content: "hello" },
                ],
            },
        })) {
            // Consume the response so the request is captured.
        }

        expect(capturedRequest?.system).toEqual([
            {
                type: "text",
                text: "assembled executor prompt\n\nconfigured system message",
                cache_control: { type: "ephemeral" },
            },
        ]);
    });

    it("replays signed thinking, tool calls, tool results, and images without flattening", () => {
        const messages = toAnthropicBedrockMessages([
            {
                role: "assistant",
                content: "I will inspect it.",
                encryptedReasoning: encodeAnthropicReasoningBlocks([
                    {
                        type: "thinking",
                        thinking: "Inspect the requested file.",
                        signature: "signed-thinking",
                    },
                    { type: "redacted_thinking", data: "redacted-thinking" },
                ]),
                toolCalls: [
                    {
                        callId: "tool-1",
                        name: "Read",
                        namespace: "files",
                        arguments: '{"file_path":"/tmp/image.png"}',
                        vendor: { type: "claude_tool_use" },
                    },
                ],
            },
            {
                role: "tool",
                callId: "tool-1",
                content: "image result",
                isError: true,
                input: [
                    { type: "text", text: "image result" },
                    { type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
                ],
            },
        ]);

        expect(messages).toEqual([
            {
                role: "assistant",
                content: [
                    {
                        type: "thinking",
                        thinking: "Inspect the requested file.",
                        signature: "signed-thinking",
                    },
                    { type: "redacted_thinking", data: "redacted-thinking" },
                    { type: "text", text: "I will inspect it." },
                    {
                        type: "tool_use",
                        id: "tool-1",
                        name: "mcp__files__Read",
                        input: { file_path: "/tmp/image.png" },
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: "tool-1",
                        content: [
                            { type: "text", text: "image result" },
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/png",
                                    data: "aW1hZ2U=",
                                },
                            },
                        ],
                        is_error: true,
                        cache_control: { type: "ephemeral" },
                    },
                ],
            },
        ]);
    });

    it("does not replay Codex-native agent messages through Anthropic Bedrock", () => {
        expect(
            toAnthropicBedrockMessages([
                {
                    role: "agent",
                    author: "root",
                    recipient: "worker",
                    header: "Delegated task",
                    encryptedContent: "encrypted",
                    agentMessageTriggerTurn: true,
                },
            ]),
        ).toEqual([]);
    });

    it("owns transient retries and reports them before inference starts", async () => {
        let attempts = 0;
        const server = createServer(async (request, response) => {
            await readBody(request);
            attempts += 1;
            if (attempts === 1) {
                response.writeHead(500, {
                    "content-type": "application/json",
                    "retry-after": "0",
                });
                response.end(
                    JSON.stringify({
                        type: "error",
                        error: { type: "api_error", message: "temporary failure" },
                    }),
                );
                return;
            }
            response.writeHead(200, { "content-type": "text/event-stream" });
            response.end(
                toSse([
                    {
                        type: "message_start",
                        message: {
                            id: "msg-retry",
                            type: "message",
                            role: "assistant",
                            content: [],
                            model: "anthropic.claude-opus-4-8",
                            stop_reason: null,
                            stop_sequence: null,
                            usage: {
                                input_tokens: 10,
                                output_tokens: 0,
                            },
                        },
                    },
                    {
                        type: "content_block_start",
                        index: 0,
                        content_block: { type: "text", text: "" },
                    },
                    {
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "text_delta", text: "recovered" },
                    },
                    { type: "content_block_stop", index: 0 },
                    {
                        type: "message_delta",
                        delta: { stop_reason: "end_turn", stop_sequence: null },
                        usage: { output_tokens: 1 },
                    },
                    { type: "message_stop" },
                ]),
            );
        });
        await listen(server);
        const address = server.address();
        if (address === null || typeof address === "string") {
            throw new Error("Missing Anthropic Bedrock retry server port.");
        }
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-retry-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const provider = new AnthropicBedrockProvider({
            credential,
            endpoint: `http://127.0.0.1:${address.port}`,
            model: "anthropic/opus-4-8",
            region: "us-east-1",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: "", messages: [] },
            tools: [],
        });

        try {
            const events: SessionEvent[] = [];
            for await (const event of session.run({
                context: { messages: [{ role: "user", content: "retry once" }] },
            })) {
                events.push(event);
            }
            expect(attempts).toBe(2);
            expect(events[0]).toMatchObject({ type: "retrying", attempt: 1 });
            expect(events).toContainEqual({ type: "text_delta", delta: "recovered" });
            expect(events.at(-1)).toEqual({ type: "done", state: "normal" });
        } finally {
            session.destroy();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it("frames request failures as a reset block", async () => {
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-error-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async () => {
                        throw new Error("request rejected");
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: "", messages: [] },
            tools: [],
        });

        const events: SessionEvent[] = [];
        for await (const event of session.run({
            context: { messages: [{ role: "user", content: "fail" }] },
        })) {
            events.push(event);
        }

        expect(events.slice(0, 2)).toEqual([{ type: "block_start" }, { type: "block_reset" }]);
        expect(committedSessionEvents(events)).toEqual([
            {
                type: "done",
                state: "error",
                kind: "unknown",
                message: "request rejected",
            },
        ]);
    });

    it("classifies the Bedrock input-length validation message as context overflow", () => {
        expect(
            classifyAnthropicBedrockError(
                new Error("Input is too long for requested model: 201000 tokens"),
            ),
        ).toBe("context_overflow");
    });

    it("does not classify a Bedrock access denial as a billing error", () => {
        const error = APIError.generate(
            403,
            {
                type: "error",
                error: {
                    type: "permission_error",
                    message: "AccessDeniedException: not authorized to invoke this model",
                },
            },
            undefined,
            new Headers(),
        );

        expect(classifyAnthropicBedrockError(error)).toBe("unknown");
    });

    it("matches Anthropic retry timing headers", () => {
        const responseBody = {
            type: "error",
            error: { type: "rate_limit_error", message: "slow down" },
        };
        const withHeaders = (headers: Headers) =>
            APIError.generate(429, responseBody, undefined, headers);

        expect(
            resolveAnthropicBedrockRetryDelay(
                withHeaders(new Headers({ "retry-after-ms": "125.5" })),
                1,
            ),
        ).toBe(125.5);
        expect(
            resolveAnthropicBedrockRetryDelay(
                withHeaders(new Headers({ "retry-after": "1.25" })),
                1,
            ),
        ).toBe(1_250);
        const now = Date.UTC(2026, 0, 1);
        expect(
            resolveAnthropicBedrockRetryDelay(
                withHeaders(new Headers({ "retry-after": new Date(now + 5_000).toUTCString() })),
                1,
                () => now,
            ),
        ).toBe(5_000);
    });

    it("retries a stream that closes before response content", async () => {
        let attempts = 0;
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-stream-retry-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const client = {
            beta: {
                messages: {
                    create: async () => {
                        attempts += 1;
                        if (attempts === 1) {
                            return streamEvents([
                                {
                                    type: "message_start",
                                    message: { usage: { input_tokens: 1, output_tokens: 0 } },
                                },
                            ]);
                        }
                        return streamEvents([
                            {
                                type: "message_start",
                                message: { usage: { input_tokens: 1, output_tokens: 0 } },
                            },
                            {
                                type: "content_block_start",
                                index: 0,
                                content_block: { type: "text", text: "" },
                            },
                            {
                                type: "content_block_delta",
                                index: 0,
                                delta: { type: "text_delta", text: "recovered" },
                            },
                            { type: "content_block_stop", index: 0 },
                            {
                                type: "message_delta",
                                delta: { stop_reason: "end_turn", stop_sequence: null },
                                usage: { output_tokens: 1 },
                            },
                            { type: "message_stop" },
                        ]);
                    },
                },
            },
        } as unknown as NonNullable<AnthropicBedrockProviderOptions["client"]>;
        const provider = new AnthropicBedrockProvider({
            client,
            credential,
            model: "anthropic/opus-4-8",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: "", messages: [] },
            tools: [],
        });

        const events: SessionEvent[] = [];
        for await (const event of session.run({
            context: { messages: [{ role: "user", content: "retry the empty stream" }] },
        })) {
            events.push(event);
        }

        expect(attempts).toBe(2);
        expect(events.slice(0, 3)).toEqual([
            { type: "block_start" },
            { type: "block_reset" },
            expect.objectContaining({ type: "retrying", attempt: 1 }),
        ]);
        expect(events.filter((event) => event.type === "block_start")).toHaveLength(2);
        expect(events).toContainEqual({ type: "text_delta", delta: "recovered" });
        expect(events.at(-1)).toEqual({ type: "done", state: "normal" });
    });

    it("preserves interleaved response blocks and treats truncated tools as length", async () => {
        const events: SessionEvent[] = [];
        for await (const event of mapAnthropicBedrockStream(
            streamEvents([
                {
                    type: "message_start",
                    message: { usage: { input_tokens: 1, output_tokens: 0 } },
                },
                {
                    type: "content_block_start",
                    index: 0,
                    content_block: {
                        type: "thinking",
                        thinking: "first",
                        signature: "signature-1",
                    },
                },
                { type: "content_block_stop", index: 0 },
                {
                    type: "content_block_start",
                    index: 1,
                    content_block: {
                        type: "tool_use",
                        id: "tool-1",
                        name: "mcp__files__Read",
                        input: {},
                    },
                },
                {
                    type: "content_block_delta",
                    index: 1,
                    delta: {
                        type: "input_json_delta",
                        partial_json: '{"file_path":"one"}',
                    },
                },
                { type: "content_block_stop", index: 1 },
                {
                    type: "content_block_start",
                    index: 2,
                    content_block: {
                        type: "thinking",
                        thinking: "second",
                        signature: "signature-2",
                    },
                },
                { type: "content_block_stop", index: 2 },
                {
                    type: "content_block_start",
                    index: 3,
                    content_block: { type: "text", text: "after" },
                },
                { type: "content_block_stop", index: 3 },
                {
                    type: "message_delta",
                    delta: { stop_reason: "max_tokens", stop_sequence: null },
                    usage: { output_tokens: 4 },
                },
                { type: "message_stop" },
            ]),
            {
                tools: [
                    {
                        type: "local",
                        name: "Read",
                        namespace: "files",
                    },
                ],
            },
        )) {
            events.push(event);
        }

        const responseItems = events.find((event) => event.type === "response_items");
        if (responseItems?.type !== "response_items") {
            throw new Error("Missing Anthropic response items.");
        }
        const replay = toAnthropicBedrockMessages([
            {
                role: "assistant",
                content: "flattened",
                responseItems: responseItems.items,
            },
        ]);
        const replayContent = replay[0]?.content;
        if (!Array.isArray(replayContent)) throw new Error("Missing Anthropic replay blocks.");
        expect((replayContent as { type: string }[]).map(({ type }) => type)).toEqual([
            "thinking",
            "tool_use",
            "thinking",
            "text",
        ]);
        expect(replayContent).toEqual([
            { type: "thinking", thinking: "first", signature: "signature-1" },
            {
                type: "tool_use",
                id: "tool-1",
                name: "mcp__files__Read",
                input: { file_path: "one" },
            },
            { type: "thinking", thinking: "second", signature: "signature-2" },
            { type: "text", text: "after", cache_control: { type: "ephemeral" } },
        ]);
        expect(
            events.filter((event) => event.type === "reasoning_delta").map((event) => event.delta),
        ).toEqual(["first", "second"]);
        const eventTypes = events.map((event) => event.type);
        const encryptedReasoningIndexes = eventTypes.flatMap((type, index) =>
            type === "encrypted_reasoning" ? [index] : [],
        );
        expect(encryptedReasoningIndexes).toHaveLength(2);
        expect(encryptedReasoningIndexes[0]).toBeLessThan(eventTypes.indexOf("tool_call_start"));
        expect(encryptedReasoningIndexes[1]).toBeLessThan(eventTypes.indexOf("text_delta"));
        expect(events).toContainEqual({ type: "text_delta", delta: "after" });
        expect(events).toContainEqual({
            type: "tool_call_start",
            callId: "tool-1",
            name: "Read",
            namespace: "files",
            vendor: { type: "claude_tool_use" },
        });
        expect(events.at(-1)).toEqual({ type: "done", state: "length" });
    });

    it("matches the Claude provider request on Bedrock Runtime and maps native events", async () => {
        const golden = JSON.parse(
            await readFile(
                new URL("./vendors/fixtures/claude-provider-multiturn.json", import.meta.url),
                "utf8",
            ),
        ) as {
            exchanges: {
                request: { body: Record<string, any> };
                response: { events: unknown[] };
            }[];
        };
        let captured:
            | {
                  headers: IncomingMessage["headers"];
                  path: string;
                  body: Record<string, unknown>;
              }
            | undefined;
        const server = createServer(async (request, response) => {
            captured = {
                headers: request.headers,
                path: request.url ?? "",
                body: JSON.parse((await readBody(request)).toString("utf8")),
            };
            response.writeHead(200, { "content-type": "text/event-stream" });
            response.end(toSse(golden.exchanges[0]!.response.events));
        });
        await listen(server);
        const address = server.address();
        if (address === null || typeof address === "string") {
            throw new Error("Missing Anthropic Bedrock golden server port.");
        }
        const credential = await BedrockBearerTokenCredential.tryLoad({
            bearerToken: "bedrock-golden-token",
        });
        if (credential === null) throw new Error("Expected a Bedrock test credential.");
        const model = "anthropic/opus-4-8";
        const instructions =
            "This is a deterministic provider trace. Follow exact reply and tool instructions.";
        const skill = {
            name: "provider-golden",
            description: "The exact provider skill marker is PROVIDER_SKILL_MARKER.",
            source: "file" as const,
            location: "/virtual/provider-golden/SKILL.md",
        };
        const prompt =
            "Call the Read tool exactly once with file_path /virtual/provider-golden.txt. Do not reply with text before the tool call.";
        const provider = new AnthropicBedrockProvider({
            credential,
            endpoint: `http://127.0.0.1:${address.port}`,
            model,
            region: "us-east-1",
            transport: "runtime",
        });
        const configuredInstructions = ["assembled Claude system prompt", instructions].join(
            "\n\n",
        );
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: "", messages: [] },
            modelConfigurations: {
                [model]: {
                    context: { instructions: configuredInstructions, messages: [] },
                    tools: claude_tools,
                },
            },
            skills: [skill],
            tools: claude_tools,
        });

        try {
            const events: SessionEvent[] = [];
            for await (const event of session.run({
                context: { messages: [{ role: "user", content: prompt }] },
                effort: "high",
            })) {
                events.push(event);
            }

            if (captured === undefined) {
                throw new Error("Anthropic Bedrock did not send a golden request.");
            }
            expect(captured.path).toBe(
                "/model/us.anthropic.claude-opus-4-8/invoke-with-response-stream",
            );
            expect(captured.headers.authorization).toBe("Bearer bedrock-golden-token");
            expect(captured.body).toMatchObject({
                anthropic_beta: ["context-1m-2025-08-07", "interleaved-thinking-2025-05-14"],
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 64_000,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt,
                                cache_control: { type: "ephemeral" },
                            },
                        ],
                    },
                ],
                output_config: { effort: "high" },
                thinking: { type: "adaptive" },
                tools: claude_tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.parameters,
                })),
            });
            expect(captured.body).not.toHaveProperty("model");
            expect(captured.body).not.toHaveProperty("stream");
            expect(captured.body.system).toEqual([
                {
                    type: "text",
                    text: [
                        configuredInstructions,
                        `<skills>\n<skill name="${skill.name}" source="${skill.source}" location="${skill.location}">${skill.description}</skill>\n</skills>`,
                    ].join("\n\n"),
                    cache_control: { type: "ephemeral" },
                },
            ]);
            const claudeGolden = golden.exchanges[0]!.request.body;
            expect({
                max_tokens: captured.body.max_tokens,
                output_config: captured.body.output_config,
                thinking: captured.body.thinking,
            }).toEqual({
                max_tokens: claudeGolden.max_tokens,
                output_config: claudeGolden.output_config,
                thinking: claudeGolden.thinking,
            });
            expect((captured.body.messages as { content: unknown[] }[])[0]!.content).toEqual([
                claudeGolden.messages[0].content.at(-1),
            ]);
            expect(events).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: "reasoning_delta" }),
                    expect.objectContaining({
                        type: "tool_call_start",
                        name: "Read",
                        vendor: { type: "claude_tool_use" },
                    }),
                    expect.objectContaining({ type: "tool_call_end" }),
                    {
                        type: "token_usage",
                        usage: {
                            input: 2,
                            output: 112,
                            cacheRead: 10_115,
                            cacheWrite: 1_465,
                            totalTokens: 11_694,
                        },
                    },
                    { type: "done", state: "tool_call" },
                ]),
            );
        } finally {
            session.destroy();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});

function readBody(request: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        request.once("end", () => resolve(Buffer.concat(chunks)));
        request.once("error", reject);
    });
}

function listen(server: ReturnType<typeof createServer>): Promise<void> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
}

function toSse(events: readonly unknown[]): string {
    return events
        .map(
            (event) =>
                `event: ${(event as { type?: string }).type ?? "message"}\ndata: ${JSON.stringify(event)}\n\n`,
        )
        .join("");
}

async function* streamEvents(events: readonly unknown[]) {
    for (const event of events) yield event as never;
}
