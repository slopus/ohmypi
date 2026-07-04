import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piBashTool } from "./bash.js";

describe("pi bash tool", () => {
  it("executes commands through the agent context bash", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(piBashTool, {
      command: "printf pi > out.txt && cat out.txt",
    });

    expect(result.text).toBe("pi");
    expect(await harness.readFile("/workspace/out.txt")).toBe("pi");
  });
});
