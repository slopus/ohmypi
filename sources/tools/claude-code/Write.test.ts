import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { claudeWriteTool } from "./Write.js";

describe("Claude Code Write tool", () => {
  it("writes a file through the agent context fs", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(claudeWriteTool, {
      file_path: "/workspace/write.txt",
      content: "written",
    });

    expect(result.text).toContain("File created successfully");
    expect(await harness.readFile("/workspace/write.txt")).toBe("written");
  });
});
