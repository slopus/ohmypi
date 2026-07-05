import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { codexWriteStdinTool } from "./write_stdin.js";

describe("codex write_stdin tool", () => {
    it("reports the absence of a live unified session", async () => {
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(codexWriteStdinTool, {
            session_id: 123,
        });

        expect(result.text).toContain("No active Codex unified exec session 123");
    });
});
