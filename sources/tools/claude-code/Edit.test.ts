import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { claudeEditTool } from "./Edit.js";

describe("Claude Code Edit tool", () => {
  it("remains strict about exact text", async () => {
    const harness = createJustBashToolHarness({
      files: { "/workspace/edit.txt": "alpha  \nbeta\n" },
    });

    await expect(
      harness.runTool(claudeEditTool, {
        file_path: "/workspace/edit.txt",
        old_string: "alpha\nbeta",
        new_string: "gamma\nbeta",
      }),
    ).rejects.toThrow(/old_string was not found/);

    const result = await harness.runTool(claudeEditTool, {
      file_path: "/workspace/edit.txt",
      old_string: "alpha  \nbeta",
      new_string: "gamma\nbeta",
    });

    expect(result.replacements).toBe(1);
    expect(await harness.readFile("/workspace/edit.txt")).toBe("gamma\nbeta\n");
  });
});
