import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piWriteTool } from "./write.js";

describe("pi write tool", () => {
    it("writes through the agent context fs", async () => {
        const harness = createJustBashToolHarness();

        const result = await harness.runTool(piWriteTool, {
            path: "/workspace/new.txt",
            content: "created\n",
        });

        expect(result.created).toBe(true);
        expect(await harness.readFile("/workspace/new.txt")).toBe("created\n");
    });
});
