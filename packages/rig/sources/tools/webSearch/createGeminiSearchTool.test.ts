import { describe, expect, it, vi } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { createGeminiSearchTool } from "./createGeminiSearchTool.js";

describe("gemini_search tool", () => {
    it("uses a distinct universal name and declares its external network boundary", () => {
        const tool = createGeminiSearchTool("secret-key");
        const harness = createJustBashToolHarness();

        expect(tool.name).toBe("gemini_search");
        expect(tool.requiresAutoOrFullAccess).toBe(true);
        expect(tool.shouldReviewInAutoMode({ query: "current docs" }, harness.context)).toBe(true);
    });

    it("runs Gemini search and formats source links for the model", async () => {
        const search = vi.fn().mockResolvedValue({
            query: "current docs 2026",
            results: [
                {
                    tool_use_id: "gemini-search-1",
                    content: [{ title: "Current docs", url: "https://example.com/docs" }],
                },
                "The current documentation is available.",
            ],
            durationSeconds: 0.5,
        });
        const tool = createGeminiSearchTool("secret-key", { search });
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(tool, {
            query: "current docs 2026",
            allowed_domains: ["example.com"],
        });

        expect(search).toHaveBeenCalledWith(
            {
                query: "current docs 2026",
                allowed_domains: ["example.com"],
            },
            undefined,
        );
        expect(tool.toLLM(result)[0]).toMatchObject({
            type: "text",
            text: expect.stringContaining(
                'Links: [{"title":"Current docs","url":"https://example.com/docs"}]',
            ),
        });
    });

    it("rejects mutually exclusive domain filters before searching", async () => {
        const search = vi.fn();
        const tool = createGeminiSearchTool("secret-key", { search });
        const harness = createJustBashToolHarness();

        await expect(
            harness.runTool(tool, {
                query: "current docs 2026",
                allowed_domains: ["example.com"],
                blocked_domains: ["example.org"],
            }),
        ).rejects.toThrow(/Cannot specify both allowed_domains and blocked_domains/);
        expect(search).not.toHaveBeenCalled();
    });
});
