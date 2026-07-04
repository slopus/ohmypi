import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { claudeWebFetchTool } from "./WebFetch.js";

describe("Claude Code WebFetch tool", () => {
  it("validates and summarizes the target hostname", async () => {
    const harness = createJustBashToolHarness();

    const result = await harness.runTool(claudeWebFetchTool, {
      url: "https://example.com/docs",
      prompt: "summarize",
    });

    expect(result.text).toBe("Claude wants to fetch content from example.com");
  });
});
