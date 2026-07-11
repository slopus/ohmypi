import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { claudeReadTool } from "./Read.js";

describe("Claude Code Read tool", () => {
    it("returns numbered text", async () => {
        const harness = createJustBashToolHarness({
            files: { "/workspace/read.txt": "one\ntwo" },
        });

        const result = await harness.runTool(claudeReadTool, {
            file_path: "/workspace/read.txt",
        });

        expect("content" in result ? result.content : "").toBe("1\tone\n2\ttwo");
    });

    it("rejects notebooks instead of presenting raw JSON as parsed cells", async () => {
        const harness = createJustBashToolHarness({
            files: { "/workspace/example.ipynb": '{"cells":[]}' },
        });

        const result = await harness.runTool(claudeReadTool, {
            file_path: "/workspace/example.ipynb",
        });

        expect("text" in result ? result.text : "").toContain("not supported");
    });
});
