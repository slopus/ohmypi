import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piLsTool } from "./ls.js";

describe("pi ls tool", () => {
  it("lists directory contents", async () => {
    const harness = createJustBashToolHarness({
      files: {
        "/workspace/a.txt": "a",
        "/workspace/dir/b.txt": "b",
      },
    });

    const result = await harness.runTool(piLsTool, {
      path: "/workspace",
    });

    expect(result.text.split("\n")).toEqual(["a.txt", "dir/"]);
  });
});
