import type { KimiChatRequest } from "./kimi-chat-types.js";
import { estimateKimiInputTokens } from "./estimateKimiInputTokens.js";
import { KIMI_MAX_COMPLETION_TOKENS } from "./kimi-constants.js";
import { toKimiChatMessages } from "./toKimiChatMessages.js";
import { toKimiChatTools } from "./toKimiChatTools.js";
import type { Context, Model, StreamOptions } from "./types.js";

export function createKimiChatRequest(options: {
    apiModelId: string;
    context: Context;
    model: Model;
    sessionId?: string;
    streamOptions?: StreamOptions;
}): KimiChatRequest {
    const contextWindow = options.model.contextWindow ?? 1_048_576;
    const maxCompletionTokens = Math.max(
        1,
        Math.min(
            KIMI_MAX_COMPLETION_TOKENS,
            contextWindow - estimateKimiInputTokens(options.context),
        ),
    );
    const sessionId = options.sessionId ?? options.streamOptions?.sessionId;
    const tools = options.context.tools ?? [];
    return {
        max_completion_tokens: maxCompletionTokens,
        messages: toKimiChatMessages(options.context),
        model: options.apiModelId,
        stream: true,
        stream_options: { include_usage: true },
        thinking: { effort: "max", keep: "all", type: "enabled" },
        ...(sessionId === undefined ? {} : { prompt_cache_key: sessionId }),
        ...(tools.length === 0 ? {} : { tools: toKimiChatTools(tools) }),
    };
}
