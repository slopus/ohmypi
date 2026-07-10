import { describe, expect, it, vi } from "vitest";

import { createJustBashToolHarness } from "./testing/createJustBashToolHarness.js";
import { agentTool } from "./Agent.js";

describe("Agent tool", () => {
    it("starts a managed subagent and forwards the tool call identity", async () => {
        const harness = createJustBashToolHarness();
        const spawn = vi.fn(async () => ({
            output: "The delegated task is complete.",
            sessionId: "subagent-1",
            status: "completed" as const,
        }));
        harness.context.subagents = {
            canSpawn: true,
            depth: 0,
            maxDepth: 3,
            spawn,
        };

        const result = await agentTool.execute(
            { description: "Inspect the tests", prompt: "Review the test suite." },
            harness.context,
            { toolCallId: "tool-1" },
        );

        expect(result).toMatchObject({ sessionId: "subagent-1", status: "completed" });
        expect(spawn).toHaveBeenCalledWith(
            {
                description: "Inspect the tests",
                parentToolCallId: "tool-1",
                prompt: "Review the test suite.",
            },
            undefined,
        );
    });

    it("rejects spawning after the maximum depth", async () => {
        const harness = createJustBashToolHarness();
        harness.context.subagents = {
            canSpawn: false,
            depth: 3,
            maxDepth: 3,
            spawn: vi.fn(),
        };

        await expect(
            agentTool.execute(
                { description: "Go deeper", prompt: "Start another agent." },
                harness.context,
                {},
            ),
        ).rejects.toThrow("maximum subagent depth");
    });

    it("reports a failed child as a failed tool call", async () => {
        const harness = createJustBashToolHarness();
        harness.context.subagents = {
            canSpawn: true,
            depth: 0,
            maxDepth: 3,
            spawn: async () => ({
                output: "The delegated check failed.",
                sessionId: "subagent-1",
                status: "error",
            }),
        };

        await expect(
            agentTool.execute(
                { description: "Run the check", prompt: "Run the delegated check." },
                harness.context,
                {},
            ),
        ).rejects.toThrow("The delegated check failed");
    });
});
