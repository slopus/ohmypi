import { describe, expect, it } from "vitest";

import { formatProviderError } from "./formatProviderError.js";

describe("formatProviderError", () => {
    it("reports exhausted tokens with an optional reset", () => {
        expect(
            formatProviderError(
                { resetAt: 121_000, type: "out_of_tokens" },
                { fallbackMessage: "raw billing error", now: 1_000, providerId: "claude" },
            ),
        ).toBe("Claude Code is out of tokens. Resets in 2m.");
        expect(
            formatProviderError(
                { type: "out_of_tokens" },
                { fallbackMessage: "raw billing error", now: 1_000, providerId: "claude" },
            ),
        ).toBe("Claude Code is out of tokens.");
    });

    it("reports ordinary rate limits for a named provider", () => {
        expect(
            formatProviderError(
                { resetAt: 61_000, type: "rate_limit" },
                { fallbackMessage: "raw 429", now: 1_000, providerId: "kirill_claude" },
            ),
        ).toBe("Kirill Claude is rate limited. Try again in 1m.");
    });

    it("preserves the provider message for unclassified errors", () => {
        expect(
            formatProviderError(
                { type: "unclassified" },
                { fallbackMessage: "Anthropic's API is unavailable", providerId: "claude" },
            ),
        ).toBe("Anthropic's API is unavailable");
    });
});
