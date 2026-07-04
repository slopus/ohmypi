import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { piReadTool } from "./read.js";

describe("pi read tool", () => {
  it("reads text from the agent context fs", async () => {
    const harness = createJustBashToolHarness({
      files: { "/workspace/note.txt": "hello\nworld" },
    });

    const result = await harness.runTool(piReadTool, {
      path: "/workspace/note.txt",
      limit: 1,
    });

    expect(result.content).toBe("hello");
    expect(result.returnedLines).toBe(1);
    expect(result.truncated).toBe(true);
  });
});
