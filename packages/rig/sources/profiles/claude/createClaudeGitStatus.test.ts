import { describe, expect, it, vi } from "vitest";

import type { BashContext, BashRunResult } from "../../agent/context/BashContext.js";
import { createClaudeGitStatus } from "./createClaudeGitStatus.js";

describe("createClaudeGitStatus", () => {
    it("reproduces Claude Code's bounded startup Git snapshot", async () => {
        const outputs = new Map([
            ["git branch --show-current", "feature/profiles\n"],
            ["git symbolic-ref --quiet --short refs/remotes/origin/HEAD", "origin/main\n"],
            ["git --no-optional-locks status --short", " M profiles.ts\n"],
            ["git --no-optional-locks log --oneline -n 5", "abc123 Add profiles\n"],
            ["git config user.name", "Rig Developer\n"],
        ]);
        const run = vi.fn(
            async ({ command }: { command: string }): Promise<BashRunResult> => ({
                exitCode: outputs.has(command) ? 0 : 1,
                stderr: "",
                stdout: outputs.get(command) ?? "",
                timedOut: false,
            }),
        );

        await expect(
            createClaudeGitStatus({ run } as unknown as BashContext, "/workspace/rig"),
        ).resolves.toBe(
            [
                "\n\ngitStatus: This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.",
                "Current branch: feature/profiles",
                "Main branch (you will usually use this for PRs): main",
                "Git user: Rig Developer",
                "Status:\nM profiles.ts",
                "Recent commits:\nabc123 Add profiles",
            ].join("\n\n"),
        );
        expect(run).toHaveBeenCalledTimes(7);
    });

    it("omits the optional snapshot when Git cannot report a branch", async () => {
        const run = vi.fn(
            async (): Promise<BashRunResult> => ({
                exitCode: 1,
                stderr: "not a repository",
                stdout: "",
                timedOut: false,
            }),
        );

        await expect(
            createClaudeGitStatus({ run } as unknown as BashContext, "/workspace"),
        ).resolves.toBeUndefined();
    });

    it("uses HEAD for a detached checkout", async () => {
        const run = vi.fn(
            async ({ command }: { command: string }): Promise<BashRunResult> => ({
                exitCode: command.includes("show-ref") ? 1 : 0,
                stderr: "",
                stdout: command.includes("log") ? "abc123 Detached commit\n" : "",
                timedOut: false,
            }),
        );

        await expect(
            createClaudeGitStatus({ run } as unknown as BashContext, "/workspace/rig"),
        ).resolves.toContain("Current branch: HEAD");
    });

    it.each([
        "git branch --show-current",
        "git --no-optional-locks status --short",
        "git --no-optional-locks log --oneline -n 5",
    ])("omits the snapshot when the required command times out: %s", async (timedOutCommand) => {
        const run = vi.fn(
            async ({ command }: { command: string }): Promise<BashRunResult> => ({
                exitCode: 0,
                stderr: "",
                stdout: command === "git branch --show-current" ? "main\n" : "",
                timedOut: command === timedOutCommand,
            }),
        );

        await expect(
            createClaudeGitStatus({ run } as unknown as BashContext, "/workspace/rig"),
        ).resolves.toBeUndefined();
    });
});
