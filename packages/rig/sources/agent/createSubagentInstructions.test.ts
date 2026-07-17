import { describe, expect, it } from "vitest";

import { createSubagentInstructions } from "./createSubagentInstructions.js";

describe("createSubagentInstructions", () => {
    it("uses Kimi's parent-handoff overlay for Kimi children", () => {
        const instructions = createSubagentInstructions(
            "Base project instructions.",
            1,
            2,
            "moonshot/kimi-k3",
        );

        expect(instructions).toContain("Base project instructions.");
        expect(instructions).toContain("You are now running as a subagent.");
        expect(instructions).toContain("The parent cannot see your context");
        expect(instructions).toContain("Do not directly ask the end user questions");
        expect(instructions).toContain("Your final message is the entire handoff");
    });

    it("replaces an existing provider overlay when a nested child changes model", () => {
        const kimiInstructions = createSubagentInstructions(
            "Base project instructions.",
            1,
            3,
            "moonshot/kimi-k3",
        );
        const codexInstructions = createSubagentInstructions(
            kimiInstructions,
            2,
            3,
            "openai/gpt-5.6-sol",
        );

        expect(codexInstructions).toContain("Base project instructions.");
        expect(codexInstructions).toContain("You are a subagent working on one delegated step.");
        expect(codexInstructions).not.toContain("You are now running as a subagent.");
        expect(codexInstructions.match(/current depth/gu)).toHaveLength(1);
    });
});
