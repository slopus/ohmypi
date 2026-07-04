import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piFindTool } from "./find.js";

describe("pi find tool", () => {
  it("searches files by glob", async () => {
    const harness = createJustBashToolHarness({
      files: {
        "/workspace/a.txt": "a",
        "/workspace/src/b.ts": "b",
      },
    });

    const result = await harness.runTool(piFindTool, {
      pattern: "*.txt",
    });

    expect(result.text).toBe("/workspace/a.txt");
  });
});
