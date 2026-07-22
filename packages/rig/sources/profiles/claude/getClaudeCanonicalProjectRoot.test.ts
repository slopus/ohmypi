import { describe, expect, it, vi } from "vitest";

import type { BashContext, BashRunResult } from "../../agent/context/BashContext.js";
import { getClaudeCanonicalProjectRoot } from "./getClaudeCanonicalProjectRoot.js";

describe("getClaudeCanonicalProjectRoot", () => {
    it("maps a linked worktree to the main repository root", async () => {
        const run = vi.fn(
            async (): Promise<BashRunResult> => ({
                exitCode: 0,
                stderr: "",
                stdout: "/workspace/main/.git\n",
                timedOut: false,
            }),
        );

        await expect(
            getClaudeCanonicalProjectRoot(
                { run } as unknown as BashContext,
                "/workspace/linked",
                "/workspace/linked",
            ),
        ).resolves.toBe("/workspace/main");
    });

    it("falls back when Git cannot safely identify a normal common directory", async () => {
        const run = vi.fn(
            async (): Promise<BashRunResult> => ({
                exitCode: 0,
                stderr: "",
                stdout: "/workspace/main/.git/modules/submodule\n",
                timedOut: false,
            }),
        );

        await expect(
            getClaudeCanonicalProjectRoot(
                { run } as unknown as BashContext,
                "/workspace/main/submodule",
                "/workspace/main/submodule",
            ),
        ).resolves.toBe("/workspace/main/submodule");
    });
});
