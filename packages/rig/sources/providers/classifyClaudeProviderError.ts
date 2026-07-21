import type { SDKAssistantMessageError, SDKRateLimitInfo } from "@anthropic-ai/claude-agent-sdk";

import type { ProviderError } from "./types.js";

export function classifyClaudeProviderError(options: {
    assistantError?: SDKAssistantMessageError;
    message: string;
    rateLimitInfo?: SDKRateLimitInfo;
}): ProviderError {
    const normalized = options.message.toLowerCase();
    const outOfTokens =
        options.assistantError === "billing_error" ||
        options.rateLimitInfo?.overageDisabledReason === "out_of_credits" ||
        normalized.includes("credit balance is too low") ||
        normalized.includes("out of extra usage") ||
        normalized.includes("out of credits");
    const resetCandidates = [
        options.rateLimitInfo?.resetsAt,
        options.rateLimitInfo?.overageResetsAt,
    ].filter(
        (value): value is number =>
            typeof value === "number" && Number.isFinite(value) && value >= 0,
    );
    const resetAt = resetCandidates.length === 0 ? undefined : Math.min(...resetCandidates) * 1_000;

    if (outOfTokens) {
        return {
            type: "out_of_tokens",
            ...(resetAt === undefined ? {} : { resetAt }),
        };
    }

    const rateLimited =
        options.assistantError === "rate_limit" ||
        options.rateLimitInfo?.status === "rejected" ||
        normalized.includes("rate limit") ||
        normalized.includes("too many requests") ||
        /(?:session|weekly|opus|sonnet|usage) limit/iu.test(options.message) ||
        /(?:^|\D)429(?:\D|$)/u.test(options.message);
    if (rateLimited) {
        return {
            type: "rate_limit",
            ...(resetAt === undefined ? {} : { resetAt }),
        };
    }

    return { type: "unclassified" };
}
