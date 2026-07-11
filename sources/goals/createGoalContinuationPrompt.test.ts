import { describe, expect, it } from "vitest";

import { createGoalContinuationPrompt } from "./createGoalContinuationPrompt.js";
import { normalizeGoalObjective } from "./normalizeGoalObjective.js";

describe("goal prompts", () => {
    it("normalizes objectives and keeps user text inside an escaped data boundary", () => {
        const objective = normalizeGoalObjective("  Finish <all> & verify  ");
        const prompt = createGoalContinuationPrompt({
            createdAt: 1,
            objective,
            status: "active",
            updatedAt: 1,
        });

        expect(objective).toBe("Finish <all> & verify");
        expect(prompt).toContain("Finish &lt;all&gt; &amp; verify");
        expect(prompt).not.toContain("Finish <all> & verify");
        expect(prompt).toContain('Use update_goal with status "complete"');
    });

    it("rejects empty objectives", () => {
        expect(() => normalizeGoalObjective("   ")).toThrow("must not be empty");
    });
});
