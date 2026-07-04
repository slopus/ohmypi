import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/harness.js";
import { claudeWebSearchTool } from "./WebSearch.js";

describe("Claude Code WebSearch tool", () => {
  it("validates mutually exclusive domain filters", async () => {
    const harness = createJustBashToolHarness();

    await expect(
      harness.runTool(claudeWebSearchTool, {
        query: "current docs 2026",
        allowed_domains: ["example.com"],
        blocked_domains: ["example.org"],
      }),
    ).rejects.toThrow(/Cannot specify both allowed_domains and blocked_domains/);

    const result = await harness.runTool(claudeWebSearchTool, {
      query: "current docs 2026",
    });
    expect(result.text).toBe("Claude wants to search the web for: current docs 2026");
  });
});
