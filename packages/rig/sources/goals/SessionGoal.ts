export type GoalStatus = "active" | "blocked" | "complete" | "paused";

export interface SessionGoal {
    createdAt: number;
    objective: string;
    status: GoalStatus;
    updatedAt: number;
}

export interface CreateGoalRequest {
    objective: string;
}

export interface ChangeGoalStatusRequest {
    status: GoalStatus;
}
