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
        expect(piGrepTool.toUI(result, { pattern: "beta", path: "/workspace", limit: 1 })).toBe(
            'Searched "beta" (1 output line)',
        );
    });

    it("truncates long lines and bounds combined output at 50KB", async () => {
        const content = Array.from(
            { length: 101 },
            (_, index) => `needle-${String(index).padStart(3, "0")}-${"x".repeat(600)}`,
        ).join("\n");
        const harness = createJustBashToolHarness({
            files: { "/workspace/long.txt": content },
        });

        const result = await harness.runTool(piGrepTool, {
            pattern: "needle",
            path: "/workspace",
        });

        expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(50 * 1024);
        expect(result.text).toContain("50KB limit reached");
        expect(result.text).toContain("Some lines truncated to 500 chars");
        expect(result.text).not.toContain("x".repeat(501));
    });
});
