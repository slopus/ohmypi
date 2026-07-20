import { describe, expect, it, vi } from "vitest";

import { performGeminiWebSearch } from "./performGeminiWebSearch.js";

describe("performGeminiWebSearch", () => {
    it("uses Gemini Google Search and returns synthesized text with source links", async () => {
        const request = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    steps: [
                        {
                            type: "google_search_call",
                            arguments: { queries: ["current Node.js release"] },
                        },
                        {
                            type: "model_output",
                            content: [
                                {
                                    type: "text",
                                    text: "Node.js 24 is the current LTS release.",
                                    annotations: [
                                        {
                                            type: "url_citation",
                                            title: "Node.js releases",
                                            url: "https://nodejs.org/en/about/previous-releases",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
                { status: 200 },
            ),
        );

        const output = await performGeminiWebSearch(
            { query: "current Node.js release", allowed_domains: ["nodejs.org"] },
            { apiKey: "secret-key", fetch: request },
        );

        expect(request).toHaveBeenCalledOnce();
        const [url, init] = request.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
        expect(init.headers).toMatchObject({ "x-goog-api-key": "secret-key" });
        expect(JSON.parse(String(init.body))).toMatchObject({
            model: "gemini-3.5-flash",
            tools: [{ type: "google_search" }],
        });
        expect(String(JSON.parse(String(init.body)).input)).toContain(
            "Only use sources from these domains: nodejs.org.",
        );
        expect(output).toEqual({
            durationSeconds: expect.any(Number),
            query: "current Node.js release",
            results: [
                {
                    content: [
                        {
                            title: "Node.js releases",
                            url: "https://nodejs.org/en/about/previous-releases",
                        },
                    ],
                    tool_use_id: "gemini-google-search",
                },
                "Node.js 24 is the current LTS release.",
            ],
        });
    });

    it("surfaces bounded Gemini API errors without including the key", async () => {
        const request = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    error: { message: "Quota exhausted", status: "RESOURCE_EXHAUSTED" },
                }),
                { status: 429 },
            ),
        );

        await expect(
            performGeminiWebSearch(
                { query: "current Node.js release" },
                { apiKey: "secret-key", fetch: request },
            ),
        ).rejects.toThrow("Gemini web search failed (429): Quota exhausted");
        await expect(
            performGeminiWebSearch(
                { query: "current Node.js release" },
                { apiKey: "secret-key", fetch: request },
            ),
        ).rejects.not.toThrow("secret-key");
    });
});
