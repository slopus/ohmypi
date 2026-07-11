import type { SubagentSummary } from "./protocol";

export function upsertSubagentSummary(
    subagents: readonly SubagentSummary[],
    next: SubagentSummary,
): readonly SubagentSummary[] {
    const existingIndex = subagents.findIndex((subagent) => subagent.id === next.id);
    if (existingIndex < 0) {
        return [...subagents, next].sort((left, right) => left.createdAt - right.createdAt);
    }
    return subagents.map((subagent, index) => (index === existingIndex ? next : subagent));
}
