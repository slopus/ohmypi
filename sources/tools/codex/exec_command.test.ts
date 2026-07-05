import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { codexExecCommandTool } from "./exec_command.js";

describe("codex exec_command tool", () => {
    it("runs a command through the agent context bash", async () => {
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(codexExecCommandTool, {
            cmd: "echo codex",
        });

        expect(result.stdout).toBe("codex\n");
        expect(result.exitCode).toBe(0);
    });
});
