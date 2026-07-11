import type { CreateGoalRequest, GoalStatus, SessionGoal } from "../../goals/index.js";

export interface GoalContext {
    create(request: CreateGoalRequest): SessionGoal;
    get(): SessionGoal | undefined;
    update(status: Extract<GoalStatus, "blocked" | "complete">): SessionGoal;
}
