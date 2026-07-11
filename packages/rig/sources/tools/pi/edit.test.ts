import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { piEditTool } from "./edit.js";
import { piReadTool } from "./read.js";

describe("pi edit tool", () => {
    it("supports PI fuzzy batch edits", async () => {
        const harness = createJustBashToolHarness({
            files: { "/workspace/sample.txt": "alpha  \nbeta\nthree\n" },
        });
        await harness.runTool(piReadTool, { path: "/workspace/sample.txt" });

        const result = await harness.runTool(piEditTool, {
            path: "/workspace/sample.txt",
            edits: [
                { oldText: "alpha\nbeta", newText: "gamma\nbeta" },
                { oldText: "three", newText: "THREE" },
            ],
        });

        expect(result).toMatchObject({ replacements: 2, fuzzy: true });
        expect(await harness.readFile("/workspace/sample.txt")).toBe("gamma\nbeta\nTHREE\n");
    });
});
