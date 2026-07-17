import { errorToMessage } from "../errorToMessage.js";
import { applyKimiChatUsage } from "./applyKimiChatUsage.js";
import type {
    KimiChatClient,
    KimiChatCompletionChunk,
    KimiChatRequest,
} from "./kimi-chat-types.js";
import { createInferenceStream } from "./createInferenceStream.js";
import { parseOpenAIToolArguments } from "./parseOpenAIToolArguments.js";
import { replaceAssistantContent } from "./replaceAssistantContent.js";
import type { AssistantMessage, AssistantMessageEvent, StopReason } from "./types.js";

export function createKimiChatCompletionStream(options: {
    client: KimiChatClient;
    modelId: string;
    providerId: string;
    request: KimiChatRequest;
    signal?: AbortSignal;
}): ReturnType<typeof createInferenceStream> {
    return createInferenceStream(async function* () {
        const partial = emptyAssistantMessage(options.providerId, options.modelId);
        yield { type: "start", partial };
        let thinkingIndex: number | undefined;
        let textIndex: number | undefined;
        const toolCalls = new Map<number, { argumentsJson: string; contentIndex: number }>();
        let finishReason: string | null | undefined;
        try {
            const stream = await options.client.chat.completions.create(
                options.request,
                options.signal === undefined ? undefined : { signal: options.signal },
            );
            for await (const chunk of stream) {
                if (chunk.id) partial.responseId = chunk.id;
                if (chunk.model) partial.responseModel = chunk.model;
                const usage = usageFromChunk(chunk);
                if (usage !== undefined) applyKimiChatUsage(partial.usage, usage);
                const choice = chunk.choices?.[0];
                if (choice?.finish_reason !== undefined && choice.finish_reason !== null) {
                    finishReason = choice.finish_reason;
                }
                const delta = choice?.delta;
                const reasoningDelta = delta?.reasoning_content;
                if (typeof reasoningDelta === "string" && reasoningDelta.length > 0) {
                    if (thinkingIndex === undefined) {
                        thinkingIndex = partial.content.length;
                        partial.content = [...partial.content, { thinking: "", type: "thinking" }];
                        yield { type: "thinking_start", contentIndex: thinkingIndex, partial };
                    }
                    const content = partial.content[thinkingIndex];
                    if (content?.type === "thinking") {
                        partial.content = replaceAssistantContent(partial.content, thinkingIndex, {
                            ...content,
                            thinking: content.thinking + reasoningDelta,
                        });
                        yield {
                            type: "thinking_delta",
                            contentIndex: thinkingIndex,
                            delta: reasoningDelta,
                            partial,
                        };
                    }
                }
                const textDelta = delta?.content;
                if (typeof textDelta === "string" && textDelta.length > 0) {
                    if (textIndex === undefined) {
                        textIndex = partial.content.length;
                        partial.content = [...partial.content, { text: "", type: "text" }];
                        yield { type: "text_start", contentIndex: textIndex, partial };
                    }
                    const content = partial.content[textIndex];
                    if (content?.type === "text") {
                        partial.content = replaceAssistantContent(partial.content, textIndex, {
                            ...content,
                            text: content.text + textDelta,
                        });
                        yield {
                            type: "text_delta",
                            contentIndex: textIndex,
                            delta: textDelta,
                            partial,
                        };
                    }
                }
                for (const toolDelta of delta?.tool_calls ?? []) {
                    const index = toolDelta.index ?? 0;
                    let active = toolCalls.get(index);
                    if (active === undefined) {
                        const name = toolDelta.function?.name;
                        if (typeof name !== "string" || name.length === 0) continue;
                        const contentIndex = partial.content.length;
                        active = { argumentsJson: "", contentIndex };
                        toolCalls.set(index, active);
                        partial.content = [
                            ...partial.content,
                            {
                                arguments: {},
                                id: toolDelta.id || `tool_call_${index}`,
                                name,
                                type: "toolCall",
                            },
                        ];
                        yield { type: "toolcall_start", contentIndex, partial };
                    }
                    const content = partial.content[active.contentIndex];
                    if (content?.type !== "toolCall") continue;
                    const argumentsDelta = toolDelta.function?.arguments ?? "";
                    active.argumentsJson += argumentsDelta;
                    partial.content = replaceAssistantContent(
                        partial.content,
                        active.contentIndex,
                        {
                            ...content,
                            arguments: parseOpenAIToolArguments(active.argumentsJson),
                            id: toolDelta.id || content.id,
                            name: toolDelta.function?.name || content.name,
                        },
                    );
                    if (argumentsDelta.length > 0) {
                        yield {
                            type: "toolcall_delta",
                            contentIndex: active.contentIndex,
                            delta: argumentsDelta,
                            partial,
                        };
                    }
                }
            }

            yield* finishActiveContent(partial, thinkingIndex, textIndex, toolCalls);
            const stopReason = normalizeFinishReason(finishReason, toolCalls.size > 0);
            if (stopReason === undefined) {
                partial.errorCode = "incomplete_response";
                throw new Error(
                    `Incomplete response returned, reason: ${finishReason ?? "unknown"}`,
                );
            }
            partial.stopReason = stopReason;
            yield { type: "done", reason: stopReason, message: partial };
            return partial;
        } catch (error) {
            partial.stopReason = options.signal?.aborted === true ? "aborted" : "error";
            partial.errorMessage = errorToMessage(error);
            yield { type: "error", reason: partial.stopReason, error: partial };
            return partial;
        }
    });
}

function emptyAssistantMessage(providerId: string, modelId: string): AssistantMessage {
    return {
        api: "kimi-chat-completions",
        content: [],
        model: modelId,
        provider: providerId,
        role: "assistant",
        stopReason: "stop",
        timestamp: Date.now(),
        usage: {
            cacheRead: 0,
            cacheWrite: 0,
            cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
            input: 0,
            output: 0,
            totalTokens: 0,
        },
    };
}

function usageFromChunk(chunk: KimiChatCompletionChunk) {
    return chunk.usage ?? chunk.choices?.[0]?.usage ?? undefined;
}

async function* finishActiveContent(
    partial: AssistantMessage,
    thinkingIndex: number | undefined,
    textIndex: number | undefined,
    toolCalls: ReadonlyMap<number, { argumentsJson: string; contentIndex: number }>,
): AsyncGenerator<AssistantMessageEvent> {
    if (thinkingIndex !== undefined) {
        const block = partial.content[thinkingIndex];
        if (block?.type === "thinking") {
            yield {
                type: "thinking_end",
                contentIndex: thinkingIndex,
                content: block.thinking,
                partial,
            };
        }
    }
    if (textIndex !== undefined) {
        const block = partial.content[textIndex];
        if (block?.type === "text") {
            yield { type: "text_end", contentIndex: textIndex, content: block.text, partial };
        }
    }
    for (const active of toolCalls.values()) {
        const block = partial.content[active.contentIndex];
        if (block?.type === "toolCall") {
            yield {
                type: "toolcall_end",
                contentIndex: active.contentIndex,
                toolCall: block,
                partial,
            };
        }
    }
}

function normalizeFinishReason(
    reason: string | null | undefined,
    hasToolCalls: boolean,
): Extract<StopReason, "length" | "stop" | "toolUse"> | undefined {
    if (reason === "length") return "length";
    if (reason === "tool_calls") return "toolUse";
    if (reason === undefined || reason === null || reason === "stop") {
        return hasToolCalls ? "toolUse" : "stop";
    }
    return undefined;
}
