import { describe, expect, it } from "vitest";

import type { ActiveWorkItem } from "./ActiveWorkItem.js";
import { renderActiveWorkItem } from "./renderActiveWorkItem.js";

describe("renderActiveWorkItem", () => {
    it.each([
        [subagentItem(), "\x1b[36mAgent", "Inspect authentication"],
        [workflowItem(), "\x1b[38;5;202mWorkflow", "Release checks"],
        [processItem(), "\x1b[32mProcess", "sleep 30"],
    ] as const)("uses the semantic color for %#", (item, coloredKind, label) => {
        const rendered = renderActiveWorkItem(item, 100);
        expect(rendered).toContain(coloredKind);
        expect(rendered).toContain(label);
        expect(rendered).not.toContain("→");
    });
});

function subagentItem(): ActiveWorkItem {
    return {
        id: "subagent:one",
        kind: "subagent",
        subagent: {
            agentId: "agent-one",
            createdAt: 1,
            depth: 1,
            description: "Inspect authentication",
            id: "one",
            modelId: "openai/test",
            parentSessionId: "root",
            status: "running",
            updatedAt: 1,
        },
    };
}

function workflowItem(): ActiveWorkItem {
    return {
        id: "workflow:two",
        kind: "workflow",
        workflow: {
            agentCount: 2,
            description: "Check the release",
            logs: [],
            name: "release-checks",
            runId: "two",
            startedAt: 1,
            status: "running",
            taskId: "workflow:two",
        },
    };
}

function processItem(): ActiveWorkItem {
    return {
        id: "process:3",
        kind: "process",
        process: {
            command: "sleep 30",
            cwd: "/workspace",
            sessionId: 3,
            status: "running",
        },
    };
}
