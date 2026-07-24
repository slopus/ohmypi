import type { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionReasoningEffort } from "@/core/SessionRunRequest.js";
import type { SessionSkill } from "@/core/SessionSkill.js";
import type { SessionTool } from "@/core/SessionTool.js";
import { toAnthropicBedrockMessages } from "@/vendors/bedrock/impl/toAnthropicBedrockMessages.js";
import { toAnthropicBedrockSystem } from "@/vendors/bedrock/impl/toAnthropicBedrockSystem.js";
import { toAnthropicBedrockTools } from "@/vendors/bedrock/impl/toAnthropicBedrockTools.js";

export type AnthropicBedrockRequest = MessageCreateParamsStreaming;

export function createAnthropicBedrockRequest(options: {
    compaction?: {
        instructions: string;
    };
    context: SessionContext;
    effort?: SessionReasoningEffort;
    model: string;
    skills: readonly SessionSkill[];
    tools: readonly SessionTool[];
}): AnthropicBedrockRequest {
    const effort = resolveEffort(options.effort);
    const system = toAnthropicBedrockSystem(options);
    const tools = toAnthropicBedrockTools(options.tools);
    const betas = ["context-1m-2025-08-07", "interleaved-thinking-2025-05-14"];
    if (options.compaction !== undefined) betas.push("compact-2026-01-12");
    return {
        betas,
        ...(options.compaction === undefined
            ? {}
            : {
                  context_management: {
                      edits: [
                          {
                              type: "compact_20260112" as const,
                              instructions: options.compaction.instructions,
                              pause_after_compaction: true,
                              trigger: { type: "input_tokens" as const, value: 50_000 },
                          },
                      ],
                  },
              }),
        max_tokens: 64_000,
        messages: toAnthropicBedrockMessages(options.context.messages),
        model: options.model,
        stream: true,
        ...(system.length === 0 ? {} : { system }),
        thinking: options.effort === "off" ? { type: "disabled" } : { type: "adaptive" },
        ...(options.effort === "off" ? {} : { output_config: { effort } }),
        ...(tools.length === 0 ? {} : { tools }),
    };
}

function resolveEffort(
    effort: SessionReasoningEffort | undefined,
): "low" | "medium" | "high" | "xhigh" | "max" {
    if (effort === undefined) return "high";
    if (effort === "off" || effort === "minimal") return "low";
    return effort;
}
