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
    });
});
