import { describe, expect, it } from "vitest";

import { classifyClaudeProviderError } from "./classifyClaudeProviderError.js";

describe("classifyClaudeProviderError", () => {
    it("classifies exhausted billing without inventing a reset time", () => {
        expect(
            classifyClaudeProviderError({
                assistantError: "billing_error",
                message: "Credit balance is too low",
            }),
        ).toEqual({ type: "out_of_tokens" });
    });

    it("classifies exhausted extra usage with the earliest available reset", () => {
        expect(
            classifyClaudeProviderError({
                assistantError: "rate_limit",
                message: "You're out of extra usage",
                rateLimitInfo: {
                    overageDisabledReason: "out_of_credits",
                    overageResetsAt: 3_000,
                    overageStatus: "rejected",
                    resetsAt: 2_000,
                    status: "rejected",
                },
            }),
        ).toEqual({ resetAt: 2_000_000, type: "out_of_tokens" });
    });

    it("keeps ordinary rate limiting distinct from exhausted credits", () => {
        expect(
            classifyClaudeProviderError({
                assistantError: "rate_limit",
                message: "You've hit your session limit",
                rateLimitInfo: {
                    rateLimitType: "five_hour",
                    resetsAt: 4_000,
                    status: "rejected",
                },
            }),
        ).toEqual({ resetAt: 4_000_000, type: "rate_limit" });
    });

    it("classifies every remaining Claude failure as unclassified", () => {
        expect(
            classifyClaudeProviderError({
                assistantError: "server_error",
                message: "Anthropic's API is temporarily unavailable",
            }),
        ).toEqual({ type: "unclassified" });
    });
});
