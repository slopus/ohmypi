import type {
    BetaCompactionBlock,
    BetaIterationsUsage,
    BetaRawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { APIConnectionError } from "@anthropic-ai/sdk/error";

import type { SessionCacheUsage } from "@/core/SessionCacheUsage.js";

export interface CollectedAnthropicBedrockCompaction {
    readonly block: BetaCompactionBlock | undefined;
    readonly usage: SessionCacheUsage;
}

export async function collectAnthropicBedrockCompaction(
    stream: AsyncIterable<BetaRawMessageStreamEvent>,
    options: { onOutputStarted?: () => void; signal?: AbortSignal } = {},
): Promise<CollectedAnthropicBedrockCompaction> {
    let block: BetaCompactionBlock | undefined;
    let iterations: BetaIterationsUsage | null = null;
    let usage: SessionCacheUsage = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
    };
    for await (const event of stream) {
        if (options.signal?.aborted) throw options.signal.reason;
        if (event.type === "message_start") {
            usage = toUsage(event.message.usage);
            iterations = event.message.usage.iterations ?? null;
            continue;
        }
        if (event.type === "content_block_start") {
            options.onOutputStarted?.();
            if (event.content_block.type === "compaction") block = event.content_block;
            continue;
        }
        if (event.type === "content_block_delta" && event.delta.type === "compaction_delta") {
            options.onOutputStarted?.();
            const content = `${block?.content ?? ""}${event.delta.content ?? ""}`;
            block = {
                type: "compaction",
                content: content.length === 0 ? null : content,
                encrypted_content: event.delta.encrypted_content,
            };
            continue;
        }
        if (event.type === "message_delta") {
            usage = mergeUsage(usage, event.usage);
            iterations = event.usage.iterations ?? null;
            continue;
        }
        if (event.type === "message_stop") {
            return {
                block,
                usage: iterations === null ? usage : toIterationsUsage(iterations),
            };
        }
    }
    throw new APIConnectionError({
        message: "Anthropic Bedrock compaction stream closed before returning message_stop.",
    });
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

function toIterationsUsage(iterations: BetaIterationsUsage): SessionCacheUsage {
    return iterations.reduce<SessionCacheUsage>(
        (total, iteration) => {
            const input = total.input + iteration.input_tokens;
            const output = total.output + iteration.output_tokens;
            const cacheRead = total.cacheRead + iteration.cache_read_input_tokens;
            const cacheWrite = total.cacheWrite + iteration.cache_creation_input_tokens;
            return {
                input,
                output,
                cacheRead,
                cacheWrite,
                totalTokens: input + output + cacheRead + cacheWrite,
            };
        },
        { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    );
}
