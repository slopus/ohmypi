import type { SubagentSummary } from "../protocol/index.js";
import { formatActivityElapsedTime } from "./formatActivityElapsedTime.js";
import { formatCompactTokens } from "./formatCompactTokens.js";
import { sortSubagentsForDisplay } from "./sortSubagentsForDisplay.js";
import { subagentElapsedMs } from "./subagentElapsedMs.js";

const LABELS = {
    aborted: "Stopped",
    completed: "Completed",
    error: "Failed",
    idle: "Idle",
    queued: "Waiting",
    running: "Running",
    suspended: "Suspended",
} as const;

export function formatSubagentRows(
    subagents: readonly SubagentSummary[],
    now: number,
): readonly string[] {
    return sortSubagentsForDisplay(subagents).map((subagent) => {
        const nestedIndent = "  ".repeat(Math.max(0, subagent.depth - 1));
        const elapsed = formatActivityElapsedTime(subagentElapsedMs(subagent, now));
        const tokens = formatCompactTokens(subagent.totalTokens ?? 0);
        return `${nestedIndent}${LABELS[subagent.status]} · ${subagent.description} · ${elapsed} · ${tokens} tokens`;
    });
}
