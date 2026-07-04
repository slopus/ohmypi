import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
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
});
