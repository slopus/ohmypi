import { describe, expect, it, vi } from "vitest";

import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { grokSpawnSubagentTool } from "./spawn_subagent.js";
import { grokFollowupSubagentTool } from "./followup_subagent.js";

describe("grokSpawnSubagentTool", () => {
    it("uses the human-readable task description in the transcript", () => {
        expect(
            grokSpawnSubagentTool.toUI(
                {
                    status: "running",
                    subagent_id: "agent-1",
                    task_name: "fix_the_login_bug",
                },
                {
                    background: true,
                    description: "Fix the login bug.",
                    prompt: "Investigate and fix the login bug.",
                },
            ),
        ).toBe("Started a subagent: Fix the login bug.");
    });

    it("humanizes the generated task name when the description is blank", () => {
        expect(
            grokSpawnSubagentTool.toUI(
                {
                    status: "running",
                    subagent_id: "agent-1",
                    task_name: "delegated_task",
                },
                { description: "  ", prompt: "Handle the delegated task." },
            ),
        ).toBe("Started a subagent: Delegated task.");
    });

    it("forwards the requested effort to the managed subagent", async () => {
        const harness = createJustBashToolHarness();
        const spawn = vi.fn(async () => ({
            output: "Complete.",
            path: "/root/inspect_code",
            sessionId: "agent-1",
            status: "completed" as const,
            taskName: "inspect_code",
        }));
        harness.context.subagents = {
            canSpawn: true,
            depth: 0,
            followUp: vi.fn(),
            interrupt: vi.fn(),
            list: () => [],
            maxDepth: 3,
            resume: vi.fn(),
            spawn,
            wait: async () => ({ agents: [], timedOut: false }),
        };

        await grokSpawnSubagentTool.execute(
            {
                background: false,
                description: "Inspect code",
                effort: "low",
                prompt: "Inspect the implementation.",
            },
            harness.context,
            { toolCallId: "tool-1" },
        );

        expect(spawn).toHaveBeenCalledWith(
            expect.objectContaining({ effort: "low", parentToolCallId: "tool-1" }),
            undefined,
        );
    });

    it("follows up a retained subagent at the requested effort", () => {
        const harness = createJustBashToolHarness();
        const followUp = vi.fn(() => ({
            description: "Inspect code",
            path: "/root/inspect_code",
            sessionId: "agent-1",
            status: "running" as const,
            taskName: "inspect_code",
        }));
        harness.context.subagents = {
            canSpawn: true,
            depth: 0,
            followUp,
            interrupt: vi.fn(),
            list: () => [],
            maxDepth: 3,
            resume: vi.fn(),
            spawn: vi.fn(),
            wait: async () => ({ agents: [], timedOut: false }),
        };

        expect(
            grokFollowupSubagentTool.execute(
                {
                    effort: "high",
                    prompt: "Inspect the final diff.",
                    target: "inspect_code",
                },
                harness.context,
                {},
            ),
        ).toMatchObject({ subagent_id: "agent-1" });
        expect(followUp).toHaveBeenCalledWith("inspect_code", "Inspect the final diff.", "high");
    });
});
