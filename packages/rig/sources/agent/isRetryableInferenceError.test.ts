import { describe, expect, it } from "vitest";

import { isRetryableInferenceError } from "./isRetryableInferenceError.js";

describe("isRetryableInferenceError", () => {
    it.each([
        new TypeError("fetch failed"),
        Object.assign(new Error("request failed"), { cause: { code: "ECONNRESET" } }),
        new Error("WebSocket error"),
        new Error("Stream disconnected before completion"),
        { errorMessage: "WebSocket closed 1006", role: "assistant" },
    ])("recognizes low-level inference transport failures", (error) => {
        expect(isRetryableInferenceError(error)).toBe(true);
    });

    it.each([
        Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
        new Error("Provider returned HTTP 401"),
        new Error("Provider returned HTTP 408"),
        new Error("Provider returned HTTP 429"),
        new Error("Provider returned HTTP 503"),
        new Error("request terminated"),
        new Error("Request timed out"),
        new Error("network error"),
        new Error("connection lost"),
        new Error("WebSocket closed 4003 invalid request"),
        new Error(
            "Codex error: An error occurred while processing your request. You can retry your request, or contact support.",
        ),
        new Error("Invalid request"),
        new Error("Context window exceeded"),
    ])("does not retry non-transport or user-initiated failures", (error) => {
        expect(isRetryableInferenceError(error)).toBe(false);
    });
});
