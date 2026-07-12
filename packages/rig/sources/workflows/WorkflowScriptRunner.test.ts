import { describe, expect, it, vi } from "vitest";

import type { AgentContext, SpawnSubagentRequest } from "../agent/index.js";
import type { WorkflowAgentCacheEntry, WorkflowCheckpoint } from "./WorkflowContext.js";
import { WorkflowScriptRunner } from "./WorkflowScriptRunner.js";

describe("WorkflowScriptRunner", () => {
    it("runs parallel agents through Monty and returns one structured value", async () => {
        const active = new Set<string>();
        let release: (() => void) | undefined;
        const bothStarted = new Promise<void>((resolve) => {
            release = resolve;
        });
        const spawn = vi.fn(async (request: SpawnSubagentRequest) => {
            active.add(request.prompt);
            if (active.size === 2) release?.();
            await bothStarted;
            const output = request.prompt.includes("ALPHA")
                ? '{"name":"alpha","ok":true}'
                : '{"name":"beta","ok":true}';
            return {
                output,
                path: `/root/${request.taskName}`,
                sessionId: request.taskName ?? "child",
                status: "completed" as const,
                taskName: request.taskName ?? "child",
            };
        });
        const logs: string[] = [];
        let agentCount = 0;
        const runner = new WorkflowScriptRunner({
            agentContext: createContext(spawn),
            args: { target: "tests" },
            onAgentCall: () => {
                agentCount += 1;
            },
            onLog: (message) => logs.push(message),
            resumeAgentCalls: [],
            signal: new AbortController().signal,
            workflowRunId: "parallel_test",
        });

        const result = await runner.run(
            [
                'phase("Inspect")',
                'schema = {"type": "object", "required": ["name", "ok"], "properties": {"name": {"type": "string"}, "ok": {"const": True}}}',
                "checks = parallel([",
                '    {"prompt": "Return ALPHA as JSON.", "label": "Alpha", "schema": schema},',
                '    {"prompt": "Return BETA as JSON.", "label": "Beta", "schema": schema},',
                "])",
                '{"target": args["target"], "checks": checks}',
            ].join("\n"),
        );

        expect(result.output).toEqual({
            checks: [
                { name: "alpha", ok: true },
                { name: "beta", ok: true },
            ],
            target: "tests",
        });
        expect(agentCount).toBe(2);
        expect(spawn).toHaveBeenCalledTimes(2);
        expect(logs).toContain("Phase: Inspect");
    });

    it("reuses the unchanged prefix from a previous run", async () => {
        const spawn = vi.fn();
        const cached = {
            output: "cached answer",
            signature: JSON.stringify({ options: { label: "Cached" }, prompt: "Inspect once." }),
        };
        const runner = new WorkflowScriptRunner({
            agentContext: createContext(spawn),
            args: null,
            onAgentCall: vi.fn(),
            onLog: vi.fn(),
            resumeAgentCalls: [cached],
            signal: new AbortController().signal,
            workflowRunId: "resume_test",
        });

        const result = await runner.run(
            ['answer = agent("Inspect once.", {"label": "Cached"})', "answer"].join("\n"),
        );

        expect(result.output).toBe("cached answer");
        expect(result.agentCalls).toEqual([cached]);
        expect(spawn).not.toHaveBeenCalled();
    });

    it("checkpoints at external calls and resumes the pending agent without replaying Python", async () => {
        let latestCheckpoint: WorkflowCheckpoint | undefined;
        const completedAgentCalls: (WorkflowAgentCacheEntry | undefined)[] = [];
        const firstSpawn = vi.fn(async (request: SpawnSubagentRequest) => {
            if (request.prompt === "First prompt") {
                return completedResult(request, "FIRST_RESULT");
            }
            throw new Error("Simulated host interruption");
        });
        const script = [
            'phase("Inspect")',
            'first = agent("First prompt", {"label": "First"})',
            'second = agent("Second prompt", {"label": "Second", "model": "openai/gpt-5.6"})',
            '{"first": first, "second": second}',
        ].join("\n");
        const interrupted = new WorkflowScriptRunner({
            agentContext: createContext(firstSpawn),
            args: null,
            onAgentCall: vi.fn(),
            onAgentResult: (index, result) => {
                completedAgentCalls[index] = result;
            },
            onCheckpoint: (checkpoint) => {
                latestCheckpoint = checkpoint;
            },
            onLog: vi.fn(),
            resumeAgentCalls: [],
            signal: new AbortController().signal,
            workflowRunId: "checkpoint_initial",
        });

        await expect(interrupted.run(script)).rejects.toThrow("Simulated host interruption");
        expect(latestCheckpoint).toMatchObject({ nextAgentCallIndex: 1, phase: "Inspect" });
        expect(completedAgentCalls[0]).toMatchObject({ output: "FIRST_RESULT" });

        const resumedSpawn = vi.fn(async (request: SpawnSubagentRequest) =>
            completedResult(request, "SECOND_RESULT"),
        );
        const resumed = new WorkflowScriptRunner({
            agentContext: createContext(resumedSpawn),
            args: null,
            onAgentCall: vi.fn(),
            onLog: vi.fn(),
            resumeAgentCalls: completedAgentCalls,
            resumeCheckpoint: latestCheckpoint!,
            signal: new AbortController().signal,
            workflowRunId: "checkpoint_resumed",
        });

        await expect(resumed.run(script)).resolves.toMatchObject({
            output: { first: "FIRST_RESULT", second: "SECOND_RESULT" },
        });
        expect(resumedSpawn).toHaveBeenCalledOnce();
        expect(resumedSpawn).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: "openai/gpt-5.6",
                prompt: "Second prompt",
                taskName: "workflow_checkpoint_resumed_2",
            }),
            expect.any(AbortSignal),
        );
    });

    it("keeps pipeline cache identities stable when items finish out of order", async () => {
        let releaseFirstItem: (() => void) | undefined;
        const firstItemCanFinish = new Promise<void>((resolve) => {
            releaseFirstItem = resolve;
        });
        const spawn = vi.fn(async (request: SpawnSubagentRequest) => {
            const isFirstStage = request.prompt.startsWith("First stage");
            const isFirstItem = request.prompt.includes("Original item (1/2)");
            if (isFirstStage && isFirstItem) await firstItemCanFinish;
            if (isFirstStage && !isFirstItem) releaseFirstItem?.();
            return {
                output: `${isFirstItem ? "alpha" : "beta"}-${isFirstStage ? "first" : "second"}`,
                path: `/root/${request.taskName}`,
                sessionId: request.taskName ?? "child",
                status: "completed" as const,
                taskName: request.taskName ?? "child",
            };
        });
        const script = [
            'pipeline(["alpha", "beta"], [',
            '    {"prompt": "First stage", "label": "First"},',
            '    {"prompt": "Second stage", "label": "Second"},',
            "]) ",
        ].join("\n");
        const first = new WorkflowScriptRunner({
            agentContext: createContext(spawn),
            args: null,
            onAgentCall: vi.fn(),
            onLog: vi.fn(),
            resumeAgentCalls: [],
            signal: new AbortController().signal,
            workflowRunId: "pipeline_test",
        });

        const initial = await first.run(script);

        expect(initial.output).toEqual(["alpha-second", "beta-second"]);
        expect(initial.agentCalls).toHaveLength(4);
        expect(spawn.mock.calls.map(([request]) => request.taskName)).toEqual([
            "workflow_pipeline_test_1",
            "workflow_pipeline_test_3",
            "workflow_pipeline_test_4",
            "workflow_pipeline_test_2",
        ]);

        const resumedSpawn = vi.fn();
        const resumed = new WorkflowScriptRunner({
            agentContext: createContext(resumedSpawn),
            args: null,
            onAgentCall: vi.fn(),
            onLog: vi.fn(),
            resumeAgentCalls: initial.agentCalls,
            signal: new AbortController().signal,
            workflowRunId: "pipeline_resume_test",
        });

        await expect(resumed.run(script)).resolves.toMatchObject({ output: initial.output });
        expect(resumedSpawn).not.toHaveBeenCalled();
    });
});

function createContext(spawn: ReturnType<typeof vi.fn>): AgentContext {
    return {
        subagents: {
            canSpawn: true,
            depth: 0,
            followUp: vi.fn(),
            interrupt: vi.fn(),
            list: vi.fn(() => []),
            maxDepth: 3,
            spawn,
            wait: vi.fn(),
        },
    } as unknown as AgentContext;
}

function completedResult(request: SpawnSubagentRequest, output: string) {
    return {
        output,
        path: `/root/${request.taskName}`,
        sessionId: request.taskName ?? "child",
        status: "completed" as const,
        taskName: request.taskName ?? "child",
    };
}
