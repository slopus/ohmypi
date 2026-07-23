import type { ReasoningEffort } from "openai/resources/shared.js";

import type { SessionReasoningEffort } from "@/core/SessionRunRequest.js";

export function toOpenAIReasoningEffort(
    effort: SessionReasoningEffort,
): ReasoningEffort | undefined {
    if (effort === "off") {
        return "none";
    }
    if (
        effort === "minimal" ||
        effort === "low" ||
        effort === "medium" ||
        effort === "high" ||
        effort === "xhigh" ||
        effort === "max"
    ) {
        return effort;
    }

    return undefined;
}
