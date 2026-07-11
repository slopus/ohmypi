import { describe, expect, it } from "vitest";

import { createCodeReviewPrompt } from "./createCodeReviewPrompt.js";

describe("createCodeReviewPrompt", () => {
    it("creates a findings-first review prompt with an optional focus", () => {
        const prompt = createCodeReviewPrompt("  /review focus on concurrency  ");

        expect(prompt).toContain("Do not modify files");
        expect(prompt).toContain("Lead with findings ordered by severity");
        expect(prompt).toContain("focus especially on: focus on concurrency");
    });

    it("ignores unrelated slash commands", () => {
        expect(createCodeReviewPrompt("/reviewer")).toBeUndefined();
    });
});
