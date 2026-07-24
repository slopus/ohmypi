import type {
    BetaContentBlockParam,
    BetaImageBlockParam,
    BetaMessageParam,
    BetaTextBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import type {
    SessionAssistantMessage,
    SessionImageContent,
    SessionInputContent,
    SessionMessage,
    SessionTextContent,
    SessionToolResultMessage,
} from "@/core/SessionContext.js";
import { toAnthropicBedrockCompactionBlock } from "@/vendors/bedrock/impl/toAnthropicBedrockCompactionBlock.js";
import { toAnthropicBedrockToolName } from "@/vendors/bedrock/impl/toAnthropicBedrockToolName.js";

export type AnthropicReasoningState =
    | { type: "thinking"; thinking: string; signature: string }
    | { type: "redacted_thinking"; data: string };

export function toAnthropicBedrockMessages(
    messages: readonly SessionMessage[],
): BetaMessageParam[] {
    const converted = messages.flatMap((message): BetaMessageParam[] => {
        if (message.role === "system") return [];
        if (message.role === "compaction") {
            return [{ role: "assistant", content: [toAnthropicBedrockCompactionBlock(message)] }];
        }
        if (message.role === "user") {
            return [{ role: "user", content: toInputContent(message.content, message.input) }];
        }
        if (message.role === "tool") {
            return [{ role: "user", content: [toToolResult(message)] }];
        }
        if (message.role === "agent") return [];
        return [{ role: "assistant", content: toAssistantContent(message) }];
    });
    const last = converted.at(-1);
    if (last !== undefined) last.content = addCacheBreakpoint(last.content);
    return converted;
}

export function encodeAnthropicReasoning(state: AnthropicReasoningState): string {
    return JSON.stringify({ provider: "anthropic", ...state });
}

export function encodeAnthropicReasoningBlocks(blocks: readonly AnthropicReasoningState[]): string {
    return JSON.stringify({ provider: "anthropic", blocks });
}

export function encodeAnthropicResponseItem(block: BetaContentBlockParam): string {
    return JSON.stringify({ provider: "anthropic", block });
}

function toInputContent(
    content: string,
    input?: SessionInputContent,
): string | BetaContentBlockParam[] {
    if (input === undefined) return content;
    return input.map(toInputBlock);
}

function toInputBlock(block: SessionTextContent | SessionImageContent): BetaContentBlockParam {
    if (block.type === "text") return { type: "text", text: block.text };
    return {
        type: "image",
        source: {
            type: "base64",
            media_type: block.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: block.data,
        },
    };
}

function toAssistantContent(message: SessionAssistantMessage): BetaContentBlockParam[] {
    const replay = decodeAnthropicResponseItems(message.responseItems);
    if (replay.length > 0) return replay;
    return [
        ...decodeAnthropicReasoning(message.encryptedReasoning),
        ...(message.content.length === 0 ? [] : [{ type: "text" as const, text: message.content }]),
        ...(message.toolCalls ?? []).map((call) => ({
            type: "tool_use" as const,
            id: call.callId,
            name: toAnthropicBedrockToolName(call),
            input: parseArguments(call.arguments),
        })),
    ];
}

function decodeAnthropicResponseItems(
    items: readonly string[] | undefined,
): BetaContentBlockParam[] {
    if (items === undefined || items.length === 0) return [];
    const blocks = items.map(decodeAnthropicResponseItem);
    return blocks.every((block) => block !== undefined) ? (blocks as BetaContentBlockParam[]) : [];
}

function decodeAnthropicResponseItem(value: string): BetaContentBlockParam | undefined {
    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("provider" in parsed) ||
            parsed.provider !== "anthropic" ||
            !("block" in parsed)
        ) {
            return undefined;
        }
        const blocks = toReplayBlock(parsed.block);
        return blocks.length === 1 ? blocks[0] : undefined;
    } catch {
        return undefined;
    }
}

function decodeAnthropicReasoning(value: string | undefined): BetaContentBlockParam[] {
    if (value === undefined) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "provider" in parsed &&
            parsed.provider === "anthropic"
        ) {
            if ("blocks" in parsed && Array.isArray(parsed.blocks)) {
                return parsed.blocks.flatMap(toReasoningBlock);
            }
            return toReasoningBlock(parsed);
        }
    } catch {
        return [];
    }
    return [];
}

function toReasoningBlock(value: unknown): BetaContentBlockParam[] {
    if (typeof value !== "object" || value === null || !("type" in value)) return [];
    if (
        value.type === "thinking" &&
        "thinking" in value &&
        typeof value.thinking === "string" &&
        "signature" in value &&
        typeof value.signature === "string"
    ) {
        return [
            {
                type: "thinking",
                thinking: value.thinking,
                signature: value.signature,
            },
        ];
    }
    if (value.type === "redacted_thinking" && "data" in value && typeof value.data === "string") {
        return [{ type: "redacted_thinking", data: value.data }];
    }
    return [];
}

function toReplayBlock(value: unknown): BetaContentBlockParam[] {
    const reasoning = toReasoningBlock(value);
    if (reasoning.length > 0) return reasoning;
    if (typeof value !== "object" || value === null || !("type" in value)) return [];
    if (value.type === "text" && "text" in value && typeof value.text === "string") {
        return [{ type: "text", text: value.text }];
    }
    if (
        value.type === "tool_use" &&
        "id" in value &&
        typeof value.id === "string" &&
        "name" in value &&
        typeof value.name === "string" &&
        "input" in value &&
        typeof value.input === "object" &&
        value.input !== null &&
        !Array.isArray(value.input)
    ) {
        return [
            {
                type: "tool_use",
                id: value.id,
                name: value.name,
                input: value.input,
            },
        ];
    }
    return [];
}

function toToolResult(message: SessionToolResultMessage): BetaContentBlockParam {
    return {
        type: "tool_result",
        tool_use_id: message.callId,
        content:
            message.input === undefined
                ? message.content
                : message.input.map(toToolResultContentBlock),
        ...(message.isError === undefined ? {} : { is_error: message.isError }),
    };
}

function toToolResultContentBlock(
    block: SessionTextContent | SessionImageContent,
): BetaTextBlockParam | BetaImageBlockParam {
    if (block.type === "text") return { type: "text", text: block.text };
    return {
        type: "image",
        source: {
            type: "base64",
            media_type: block.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: block.data,
        },
    };
}

function parseArguments(argumentsJson: string): Record<string, unknown> {
    try {
        const value: unknown = JSON.parse(argumentsJson);
        return value !== null && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function addCacheBreakpoint(content: string | BetaContentBlockParam[]): BetaContentBlockParam[] {
    const blocks: BetaContentBlockParam[] =
        typeof content === "string" ? [{ type: "text", text: content }] : [...content];
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const block = blocks[index];
        if (block !== undefined) {
            const cached = withCacheBreakpoint(block);
            if (cached === undefined) continue;
            blocks[index] = cached;
            break;
        }
    }
    return blocks;
}

function withCacheBreakpoint(block: BetaContentBlockParam): BetaContentBlockParam | undefined {
    const cache_control = { type: "ephemeral" as const };
    if (block.type === "text") return { ...block, cache_control };
    if (block.type === "image") return { ...block, cache_control };
    if (block.type === "tool_result") return { ...block, cache_control };
    if (block.type === "tool_use") return { ...block, cache_control };
    return undefined;
}
