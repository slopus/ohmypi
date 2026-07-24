import { describe, expect, it } from "vitest";

import { claude_fable_5_system_prompt } from "@/prompts/claude/claude_fable_5_system_prompt.js";
import { claude_opus_4_8_system_prompt } from "@/prompts/claude/claude_opus_4_8_system_prompt.js";
import { claude_opus_5_system_prompt } from "@/prompts/claude/claude_opus_5_system_prompt.js";
import { claude_sonnet_5_system_prompt } from "@/prompts/claude/claude_sonnet_5_system_prompt.js";

describe("Claude system prompts", () => {
    it.each([
        claude_fable_5_system_prompt,
        claude_opus_4_8_system_prompt,
        claude_opus_5_system_prompt,
        claude_sonnet_5_system_prompt,
    ])("omits captured environment data", (prompt) => {
        expect(prompt).not.toContain("# Environment");
        expect(prompt).not.toContain("$CLAUDE_RUNTIME_");
    });

    it.each([
        claude_fable_5_system_prompt,
        claude_opus_4_8_system_prompt,
        claude_sonnet_5_system_prompt,
    ])("surfaces the knowledge cutoff that the captured environment carried", (prompt) => {
        expect(prompt).toContain("Knowledge cutoff: January 2026.");
    });

    it("matches the Opus 5 capture, which omits the knowledge cutoff line", () => {
        expect(claude_opus_5_system_prompt).not.toContain("Knowledge cutoff:");
    });
});
