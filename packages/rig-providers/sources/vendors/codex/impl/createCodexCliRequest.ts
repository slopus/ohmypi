import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";

import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionReasoningEffort } from "@/core/SessionRunRequest.js";
import type { SessionSkill } from "@/core/SessionSkill.js";
import type { SessionTool } from "@/core/SessionTool.js";
import { createOpenAIResponseRequest } from "@/responses/createOpenAIResponseRequest.js";
import { isCodexV2Model } from "@/vendors/codex/impl/isCodexV2Model.js";
import { toCodexToolDefinitions } from "@/vendors/codex/impl/toCodexToolDefinitions.js";
import { withCodexSkills } from "@/vendors/codex/impl/withCodexSkills.js";

export function createCodexCliRequest(options: {
    context: SessionContext;
    effort?: SessionReasoningEffort;
    model: string;
    promptCacheKey: string;
    skills: readonly SessionSkill[];
    tools: readonly SessionTool[];
}): ResponseCreateParamsStreaming {
    const request = createOpenAIResponseRequest({
        ...options,
        context: withCodexSkills(options.context, options.skills, options.model),
    }) as ResponseCreateParamsStreaming &
        Record<string, unknown>;
    request.tool_choice = "auto";
    if (isCodexV2Model(options.model)) {
        request.parallel_tool_calls = false;
        if (request.reasoning !== undefined) request.reasoning = { ...request.reasoning, context: "all_turns" } as never;
        delete request.instructions;
        request.input = [
            { type: "message", role: "developer", content: options.context.instructions },
            ...(request.input as unknown[]),
        ] as never;
        delete request.tools;
    } else {
        request.parallel_tool_calls = true;
        request.tools = toCodexToolDefinitions(options.tools) as never;
    }
    return request;
}

export function createCodexCliWarmupRequest(
    request: ResponseCreateParamsStreaming,
    tools: readonly SessionTool[],
): Record<string, unknown> {
    const warmup = structuredClone(request) as unknown as Record<string, unknown>;
    warmup.generate = false;
    const model = String(warmup.model);
    if (isCodexV2Model(model)) {
        const instructions = (warmup.input as unknown[]).filter(
            (item) =>
                typeof item === "object" &&
                item !== null &&
                (item as { role?: unknown }).role === "developer",
        );
        warmup.input = [
            ...(tools.length === 0
                ? []
                : [{ type: "additional_tools", tools: toCodexToolDefinitions(tools) }]),
            ...instructions.slice(0, 1),
        ];
    } else {
        warmup.input = [];
    }
    return warmup;
}
