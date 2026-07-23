import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";

import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionReasoningEffort } from "@/core/SessionRunRequest.js";
import { toOpenAIResponseInput } from "@/responses/toOpenAIResponseInput.js";
import { toOpenAIReasoningEffort } from "@/vendors/grok/impl/toOpenAIReasoningEffort.js";

export function createOpenAIResponseRequest(options: {
    context: SessionContext;
    effort?: SessionReasoningEffort;
    model: string;
    promptCacheKey?: string;
}): ResponseCreateParamsStreaming {
    const effort =
        options.effort === undefined ? undefined : toOpenAIReasoningEffort(options.effort);
    return {
        model: options.model,
        input: toOpenAIResponseInput(options.context),
        stream: true,
        store: false,
        parallel_tool_calls: true,
        text: { verbosity: "low" },
        instructions: options.context.instructions,
        ...(options.promptCacheKey === undefined
            ? {}
            : { prompt_cache_key: options.promptCacheKey }),
        ...(effort === undefined
            ? {}
            : {
                  reasoning: { effort },
                  ...(effort === "none"
                      ? {}
                      : { include: ["reasoning.encrypted_content" as const] }),
              }),
    } as ResponseCreateParamsStreaming;
}
