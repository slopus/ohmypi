import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { claudeBashTool } from "./Bash.js";

describe("Claude Code Bash tool", () => {
  it("executes commands through the agent context bash", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(claudeBashTool, {
      command: "echo claude > note.txt && cat note.txt",
    });

    expect(result.stdout).toBe("claude\n");
    expect(await harness.readFile("/workspace/note.txt")).toBe("claude\n");
  });
});
