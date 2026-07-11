export function createGoalTitle(objective: string): string {
    const singleLine = objective.replace(/\s+/gu, " ").trim();
    return singleLine.length <= 80 ? singleLine : `${singleLine.slice(0, 79).trimEnd()}…`;
}
