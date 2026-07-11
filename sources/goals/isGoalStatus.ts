import type { GoalStatus } from "./SessionGoal.js";

export function isGoalStatus(value: unknown): value is GoalStatus {
    return value === "active" || value === "paused" || value === "blocked" || value === "complete";
}
