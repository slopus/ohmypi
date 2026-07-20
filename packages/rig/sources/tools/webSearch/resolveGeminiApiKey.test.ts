import { describe, expect, it } from "vitest";

import { resolveGeminiApiKey } from "./resolveGeminiApiKey.js";

describe("resolveGeminiApiKey", () => {
    it("reads GEMINI_API_KEY", () => {
        expect(resolveGeminiApiKey({ GEMINI_API_KEY: "gemini-key" })).toBe("gemini-key");
    });

    it("does not enable search from other Gemini or Google credential variables", () => {
        expect(
            resolveGeminiApiKey({
                GEMINI_API_TOKEN: "gemini-token",
                GOOGLE_API_KEY: "google-key",
            }),
        ).toBeUndefined();
    });

    it("ignores blank values", () => {
        expect(resolveGeminiApiKey({ GEMINI_API_KEY: "  " })).toBeUndefined();
    });
});
