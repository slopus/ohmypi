import { describe, expect, it } from "vitest";

import { humanizeClaudeSdkResultSubtype } from "./humanizeClaudeSdkResultSubtype.js";

describe("humanizeClaudeSdkResultSubtype", () => {
    it.each([
        ["error_during_execution", "Claude encountered an error while running the request."],
        ["error_max_turns", "Claude reached the maximum number of turns."],
        ["error_max_budget_usd", "Claude reached the configured spending limit."],
        [
            "error_max_structured_output_retries",
            "Claude could not produce valid structured output after repeated attempts.",
        ],
    ] as const)("humanizes %s", (subtype, message) => {
        expect(humanizeClaudeSdkResultSubtype(subtype)).toBe(message);
    });
});
