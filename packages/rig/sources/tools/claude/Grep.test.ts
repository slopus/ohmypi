import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { claudeGrepTool } from "./Grep.js";

describe("Claude Code Grep tool", () => {
    it("returns files with matches by default", async () => {
        const harness = createJustBashToolHarness({
            files: {
                "/workspace/a.txt": "needle\n",
                "/workspace/b.txt": "hay\n",
            },
        });

        const result = await harness.runTool(claudeGrepTool, {
            pattern: "needle",
        });

        expect(result.text).toBe("/workspace/a.txt");
        expect(claudeGrepTool.toUI(result, { pattern: "needle" })).toBe(
            'Searched "needle" (1 output line)',
        );
    });

    it("treats a dash-prefixed pattern as search text", async () => {
        const harness = createJustBashToolHarness({
            files: { "/workspace/arrows.txt": "left -> right\n" },
        });

        const result = await harness.runTool(claudeGrepTool, {
            output_mode: "content",
            path: "/workspace",
            pattern: "->",
        });

        expect(result.text).toContain("left -> right");
    });
});
