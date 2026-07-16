import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { sessionGoalSchema } from "./goalSchemas.js";

export const getGoalTool = defineTool({
    name: "get_goal",
    label: "get_goal",
    description: "Get the persistent goal for this session, including its objective and status.",
    arguments: Type.Object({}, { additionalProperties: false }),
    returnType: Type.Object({ goal: Type.Union([sessionGoalSchema, Type.Null()]) }),
    shouldReviewInAutoMode: () => false,
    execute(_args, context) {
        if (context.goals === undefined) {
            throw new Error("Goal tracking is unavailable in this session.");
        }
        return { goal: context.goals.get() ?? null };
    },
    toLLM: ({ goal }) => [
        {
            type: "text",
            text:
                goal === null
                    ? "This session has no goal."
                    : `Goal status: ${goal.status}\nObjective: ${goal.objective}`,
        },
    ],
    toUI: ({ goal }) => (goal === null ? "No active goal" : `Read ${goal.status} goal`),
    locks: [],
});
