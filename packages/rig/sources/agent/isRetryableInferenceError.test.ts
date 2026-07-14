import { describe, expect, it } from "vitest";

import { isRetryableInferenceError } from "./isRetryableInferenceError.js";

describe("isRetryableInferenceError", () => {
    it.each([
        new TypeError("fetch failed"),
        Object.assign(new Error("request failed"), { cause: { code: "ECONNRESET" } }),
        new Error("Stream disconnected before completion"),
        new Error("Provider returned HTTP 503"),
        new Error(
            "Codex error: An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 959fcb61-d6b8-42d8-b224-e11bc88333d8 in your message.",
        ),
        { errorMessage: "Request timed out", role: "assistant" },
    ])("recognizes transient inference failures", (error) => {
        expect(isRetryableInferenceError(error)).toBe(true);
    });

    it.each([
        Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
        new Error("Provider returned HTTP 401"),
        new Error("Invalid request"),
        new Error("Context window exceeded"),
    ])("does not retry permanent or user-initiated failures", (error) => {
        expect(isRetryableInferenceError(error)).toBe(false);
    });
});
