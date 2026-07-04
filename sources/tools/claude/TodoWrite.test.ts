import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { claudeTodoWriteTool } from "./TodoWrite.js";

describe("Claude Code TodoWrite tool", () => {
  it("accepts structured todo updates", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(claudeTodoWriteTool, {
      todos: [
        {
          content: "Run tests",
          activeForm: "Running tests",
          status: "in_progress",
        },
      ],
    });

    expect(result.text).toContain("1 item(s)");
  });
});
