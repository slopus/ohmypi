import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { codexApplyPatchTool } from "./apply_patch.js";

describe("codex apply_patch tool", () => {
  it("applies Codex-style add-file patches", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(codexApplyPatchTool, {
      workdir: "/workspace",
      patch: [
        "*** Begin Patch",
        "*** Add File: created.txt",
        "+hello",
        "+world",
        "*** End Patch",
      ].join("\n"),
    });

    expect(result.text).toBe("Success. Updated the following files:\nA created.txt");
    expect(await harness.readFile("/workspace/created.txt")).toBe("hello\nworld");
  });
});
