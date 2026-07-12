import type { BashSessionActivity } from "../agent/context/BashContext.js";
import type { SubagentSummary, WorkflowRun } from "../protocol/index.js";
import type { ActiveWorkItem } from "./ActiveWorkItem.js";

export function createActiveWorkItems(options: {
    processes: readonly BashSessionActivity[];
    subagents: readonly SubagentSummary[];
    workflows: readonly WorkflowRun[];
}): ActiveWorkItem[] {
    const subagents: ActiveWorkItem[] = options.subagents
        .filter(
            (subagent) =>
                (subagent.status === "queued" || subagent.status === "running") &&
                !subagent.taskName?.startsWith("workflow_"),
        )
        .map((subagent) => ({
            id: `subagent:${subagent.id}`,
            kind: "subagent",
            subagent,
        }));
    const workflows: ActiveWorkItem[] = options.workflows
        .filter((workflow) => workflow.status === "running")
        .map((workflow) => ({
            id: `workflow:${workflow.runId}`,
            kind: "workflow",
            workflow,
        }));
    const processes: ActiveWorkItem[] = options.processes.map((process) => ({
        id: `process:${String(process.sessionId)}`,
        kind: "process",
        process,
    }));
    return [...subagents, ...workflows, ...processes];
}
