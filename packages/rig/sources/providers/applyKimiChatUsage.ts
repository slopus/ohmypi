import type { KimiChatUsage } from "./kimi-chat-types.js";
import type { Usage } from "./types.js";

export function applyKimiChatUsage(target: Usage, source: KimiChatUsage): void {
    const promptTokens = source.prompt_tokens ?? 0;
    const output = source.completion_tokens ?? 0;
    const cacheRead = source.cached_tokens ?? source.prompt_tokens_details?.cached_tokens ?? 0;
    // prompt_tokens includes cached tokens; Rig's usage keeps input and cacheRead disjoint.
    target.input = Math.max(0, promptTokens - cacheRead);
    target.output = output;
    target.cacheRead = cacheRead;
    target.cacheWrite = 0;
    target.totalTokens = source.total_tokens ?? promptTokens + output;
    const reasoning = source.completion_tokens_details?.reasoning_tokens;
    if (reasoning !== undefined) target.reasoning = reasoning;
}
