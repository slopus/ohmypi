import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piGrepTool } from "./grep.js";

describe("pi grep tool", () => {
    it("searches file contents", async () => {
        const harness = createJustBashToolHarness({
            files: {
                "/workspace/a.txt": "alpha\nbeta\n",
                "/workspace/b.txt": "beta\n",
            },
        });

        const result = await harness.runTool(piGrepTool, {
            pattern: "beta",
            path: "/workspace",
            limit: 1,
        });

        expect(result.text).toContain("/workspace/a.txt:2:beta");
    });
});
