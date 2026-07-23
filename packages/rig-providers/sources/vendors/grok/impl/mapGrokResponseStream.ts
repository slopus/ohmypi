import type { ResponseStreamEvent } from "openai/resources/responses/responses.js";

import { EMPTY_SESSION_CACHE_USAGE, type SessionCacheUsage } from "@/core/SessionCacheUsage.js";
import type { SessionEvent } from "@/core/SessionEvent.js";

interface ActiveOutputItem {
    callId?: string;
    execution?: string;
    type: "message" | "reasoning" | "function_call" | "custom_tool_call";
    argumentsJson?: string;
}

export interface GrokRunResult {
    assistantText: string;
    encryptedReasoning?: string | undefined;
    stopReason: "stop" | "length" | "tool_use";
    usage: SessionCacheUsage;
}

export async function* mapGrokResponseStream(
    responseStream: AsyncIterable<ResponseStreamEvent>,
    options: { signal?: AbortSignal; failureMessage: string },
): AsyncGenerator<SessionEvent, GrokRunResult> {
    const activeItems = new Map<number, ActiveOutputItem>();
    let assistantText = "";
    let encryptedReasoning: string | undefined;
    let sawToolUse = false;
    let usage: SessionCacheUsage = { ...EMPTY_SESSION_CACHE_USAGE };

    for await (const event of responseStream) {
        if (options.signal?.aborted) {
            return {
                assistantText,
                encryptedReasoning,
                stopReason: "stop",
                usage,
            };
        }

        if (event.type === "response.output_item.added") {
            if (event.item.type === "reasoning") {
                activeItems.set(event.output_index, { type: "reasoning" });
            } else if (event.item.type === "message") {
                activeItems.set(event.output_index, { type: "message" });
            } else if (event.item.type === "function_call") {
                sawToolUse = true;
                activeItems.set(event.output_index, {
                    type: "function_call",
                    callId: event.item.call_id,
                    execution: "client",
                    argumentsJson: event.item.arguments,
                });
            } else if (event.item.type === "custom_tool_call") {
                sawToolUse = true;
                activeItems.set(event.output_index, {
                    type: "custom_tool_call",
                    callId: event.item.call_id,
                    execution: "client",
                    argumentsJson: event.item.input,
                });
            }
            continue;
        }

        if (
            event.type === "response.reasoning_summary_text.delta" ||
            event.type === "response.reasoning_text.delta"
        ) {
            const activeItem = activeItems.get(event.output_index);
            if (activeItem?.type !== "reasoning") continue;
            yield { type: "reasoning_delta", delta: event.delta };
            continue;
        }

        if (event.type === "response.reasoning_summary_part.done") {
            yield { type: "reasoning_delta", delta: "\n\n" };
            continue;
        }

        if (
            event.type === "response.output_text.delta" ||
            event.type === "response.refusal.delta"
        ) {
            const activeItem = activeItems.get(event.output_index);
            if (activeItem?.type !== "message") continue;
            assistantText += event.delta;
            yield { type: "text_delta", delta: event.delta };
            continue;
        }

        if (event.type === "response.function_call_arguments.delta") {
            const activeItem = activeItems.get(event.output_index);
            if (activeItem?.type !== "function_call" || activeItem.callId === undefined) continue;
            activeItem.argumentsJson = (activeItem.argumentsJson ?? "") + event.delta;
            if (activeItem.execution === "server") {
                yield {
                    type: "server_tool_call_delta",
                    callId: activeItem.callId,
                    delta: event.delta,
                };
            } else {
                yield {
                    type: "tool_call_delta",
                    callId: activeItem.callId,
                    delta: event.delta,
                };
            }
            continue;
        }

        if (event.type === "response.custom_tool_call_input.delta") {
            const activeItem = activeItems.get(event.output_index);
            if (activeItem?.type !== "custom_tool_call" || activeItem.callId === undefined)
                continue;
            activeItem.argumentsJson = (activeItem.argumentsJson ?? "") + event.delta;
            yield {
                type: "tool_call_delta",
                callId: activeItem.callId,
                delta: event.delta,
            };
            continue;
        }

        if (event.type === "response.output_item.done") {
            const activeItem = activeItems.get(event.output_index);
            if (activeItem?.type === "reasoning" && event.item.type === "reasoning") {
                encryptedReasoning = JSON.stringify(event.item);
                yield { type: "encrypted_reasoning", content: encryptedReasoning };
            }
            if (activeItem?.type === "message" && event.item.type === "message") {
                assistantText = event.item.content
                    .map((part) => (part.type === "output_text" ? part.text : part.refusal))
                    .join("");
            }
            activeItems.delete(event.output_index);
            continue;
        }

        if (event.type === "response.incomplete") {
            const reason = event.response.incomplete_details?.reason ?? "unknown";
            usage = readResponseUsage(event.response.usage);
            if (usage.totalTokens > 0) {
                yield { type: "token_usage", usage };
            }
            if (reason === "max_output_tokens") {
                yield { type: "done", state: "length" };
                return {
                    assistantText,
                    encryptedReasoning,
                    stopReason: "length",
                    usage,
                };
            }
            throw new Error(`Incomplete response returned, reason: ${reason}`);
        }

        if (event.type === "response.completed") {
            usage = readResponseUsage(event.response.usage);
            yield { type: "token_usage", usage };
            yield {
                type: "done",
                state: sawToolUse ? "tool_call" : "normal",
            };
            return {
                assistantText,
                encryptedReasoning,
                stopReason: sawToolUse ? "tool_use" : "stop",
                usage,
            };
        }

        if (event.type === "error") {
            throw new Error(
                event.code === null ? event.message : `${event.code}: ${event.message}`,
            );
        }

        if (event.type === "response.failed") {
            throw new Error(
                event.response.error?.message ??
                    event.response.incomplete_details?.reason ??
                    options.failureMessage,
            );
        }
    }

    yield { type: "token_usage", usage };
    yield {
        type: "done",
        state: sawToolUse ? "tool_call" : "normal",
    };
    return {
        assistantText,
        encryptedReasoning,
        stopReason: sawToolUse ? "tool_use" : "stop",
        usage,
    };
}

function readResponseUsage(
    usage:
        | {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
              input_tokens_details?: {
                  cached_tokens?: number;
                  cache_write_tokens?: number;
              };
          }
        | undefined,
): SessionCacheUsage {
    const cachedTokens = usage?.input_tokens_details?.cached_tokens ?? 0;
    const cacheWriteTokens = usage?.input_tokens_details?.cache_write_tokens ?? 0;
    const input = Math.max(0, (usage?.input_tokens ?? 0) - cachedTokens - cacheWriteTokens);
    const output = usage?.output_tokens ?? 0;
    return {
        input,
        output,
        cacheRead: cachedTokens,
        cacheWrite: cacheWriteTokens,
        totalTokens: usage?.total_tokens ?? input + output + cachedTokens + cacheWriteTokens,
    };
}
