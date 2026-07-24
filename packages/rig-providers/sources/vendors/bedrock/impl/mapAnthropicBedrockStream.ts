import type {
    BetaRawMessageStreamEvent,
    BetaStopReason,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { APIConnectionError } from "@anthropic-ai/sdk/error";

import type { SessionCacheUsage } from "@/core/SessionCacheUsage.js";
import type { SessionEvent } from "@/core/SessionEvent.js";
import type { SessionTool } from "@/core/SessionTool.js";
import { toAnthropicBedrockToolName } from "@/vendors/bedrock/impl/toAnthropicBedrockToolName.js";
import {
    type AnthropicReasoningState,
    encodeAnthropicReasoning,
    encodeAnthropicResponseItem,
} from "@/vendors/bedrock/impl/toAnthropicBedrockMessages.js";

type AnthropicReplayBlock =
    | AnthropicReasoningState
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export async function* mapAnthropicBedrockStream(
    stream: AsyncIterable<BetaRawMessageStreamEvent>,
    options: { tools?: readonly SessionTool[] } = {},
): AsyncGenerator<SessionEvent> {
    const blocks = new Map<number, AnthropicReplayBlock>();
    const tools = new Map<
        number,
        {
            callId: string;
            name: string;
            namespace?: string;
            wireName: string;
            arguments: string;
            input: Record<string, unknown>;
        }
    >();
    let usage: SessionCacheUsage = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
    };
    let stopReason: BetaStopReason | null = null;
    let started = false;
    for await (const event of stream) {
        if (!started) {
            started = true;
            yield { type: "block_start" };
        }
        if (event.type === "message_start") {
            usage = toUsage(event.message.usage);
            continue;
        }
        if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
                const wireName = event.content_block.name;
                const configured = options.tools?.find(
                    (tool) => toAnthropicBedrockToolName(tool) === wireName,
                );
                const tool = {
                    callId: event.content_block.id,
                    name: configured?.name ?? event.content_block.name,
                    ...(configured?.namespace === undefined
                        ? {}
                        : { namespace: configured.namespace }),
                    wireName,
                    arguments: "",
                    input: asObjectInput(event.content_block.input),
                };
                tools.set(event.index, tool);
                yield {
                    type: "tool_call_start",
                    callId: tool.callId,
                    name: tool.name,
                    ...(tool.namespace === undefined ? {} : { namespace: tool.namespace }),
                    vendor: { type: "claude_tool_use" },
                };
            } else if (event.content_block.type === "thinking") {
                blocks.set(event.index, {
                    type: "thinking",
                    thinking: event.content_block.thinking,
                    signature: event.content_block.signature,
                });
                if (event.content_block.thinking.length > 0) {
                    yield {
                        type: "reasoning_delta",
                        delta: event.content_block.thinking,
                    };
                }
            } else if (event.content_block.type === "redacted_thinking") {
                blocks.set(event.index, event.content_block);
            } else if (event.content_block.type === "text") {
                blocks.set(event.index, {
                    type: "text",
                    text: event.content_block.text,
                });
                if (event.content_block.text.length > 0) {
                    yield { type: "text_delta", delta: event.content_block.text };
                }
            }
            continue;
        }
        if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
                const current = blocks.get(event.index);
                if (current?.type === "text") {
                    blocks.set(event.index, {
                        type: "text",
                        text: current.text + event.delta.text,
                    });
                }
                yield { type: "text_delta", delta: event.delta.text };
            } else if (event.delta.type === "thinking_delta") {
                const current = blocks.get(event.index);
                if (current?.type === "thinking") {
                    blocks.set(event.index, {
                        ...current,
                        thinking: current.thinking + event.delta.thinking,
                    });
                }
                yield { type: "reasoning_delta", delta: event.delta.thinking };
            } else if (event.delta.type === "signature_delta") {
                const current = blocks.get(event.index);
                if (current?.type === "thinking") {
                    blocks.set(event.index, {
                        ...current,
                        signature: current.signature + event.delta.signature,
                    });
                }
            } else if (event.delta.type === "input_json_delta") {
                const current = tools.get(event.index);
                if (current !== undefined) {
                    current.arguments += event.delta.partial_json;
                    yield {
                        type: "tool_call_delta",
                        callId: current.callId,
                        delta: event.delta.partial_json,
                    };
                }
            }
            continue;
        }
        if (event.type === "content_block_stop") {
            const block = blocks.get(event.index);
            if (block?.type === "thinking" || block?.type === "redacted_thinking") {
                yield {
                    type: "encrypted_reasoning",
                    content: encodeAnthropicReasoning(block),
                };
            }
            const tool = tools.get(event.index);
            if (tool !== undefined) {
                blocks.set(event.index, {
                    type: "tool_use",
                    id: tool.callId,
                    name: tool.wireName,
                    input: parseArguments(tool.arguments, tool.input),
                });
                yield {
                    type: "tool_call_end",
                    callId: tool.callId,
                    arguments: tool.arguments,
                };
            }
            continue;
        }
        if (event.type === "message_delta") {
            usage = mergeUsage(usage, event.usage);
            stopReason = event.delta.stop_reason;
            continue;
        }
        if (event.type === "message_stop") {
            const orderedBlocks = [...blocks.entries()]
                .sort(([left], [right]) => left - right)
                .map(([, block]) => block);
            if (orderedBlocks.length > 0) {
                yield {
                    type: "response_items",
                    items: orderedBlocks.map(encodeAnthropicResponseItem),
                };
            }
            yield { type: "token_usage", usage };
            yield { type: "block_stop" };
            yield { type: "done", state: toDoneState(stopReason, tools.size > 0) };
            return;
        }
    }
    throw new APIConnectionError({
        message: "Anthropic Bedrock connection closed before returning message_stop.",
    });
}

function parseArguments(
    argumentsJson: string,
    fallback: Record<string, unknown>,
): Record<string, unknown> {
    if (argumentsJson.length === 0) return fallback;
    try {
        const value: unknown = JSON.parse(argumentsJson);
        return value !== null && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : fallback;
    } catch {
        return fallback;
    }
}

function asObjectInput(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function toUsage(usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
}): SessionCacheUsage {
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    return {
        input,
        output,
        cacheRead,
        cacheWrite,
        totalTokens: input + output + cacheRead + cacheWrite,
    };
}

function mergeUsage(
    current: SessionCacheUsage,
    update: {
        input_tokens?: number | null;
        output_tokens?: number | null;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
    },
): SessionCacheUsage {
    const input = update.input_tokens ?? current.input;
    const output = update.output_tokens ?? current.output;
    const cacheRead = update.cache_read_input_tokens ?? current.cacheRead;
    const cacheWrite = update.cache_creation_input_tokens ?? current.cacheWrite;
    return {
        input,
        output,
        cacheRead,
        cacheWrite,
        totalTokens: input + output + cacheRead + cacheWrite,
    };
}

function toDoneState(
    stopReason: BetaStopReason | null,
    sawTool: boolean,
): "normal" | "tool_call" | "length" {
    if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") {
        return "length";
    }
    if (sawTool || stopReason === "tool_use" || stopReason === "pause_turn") return "tool_call";
    return "normal";
}
