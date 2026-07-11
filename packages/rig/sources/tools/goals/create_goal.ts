import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { sessionGoalSchema } from "./goalSchemas.js";

export const createGoalTool = defineTool({
    name: "create_goal",
    label: "create_goal",
    description: `Create a persistent goal only when the user explicitly asks for long-running goal execution.
Do not infer a goal from an ordinary task. A new goal cannot replace an unfinished goal.`,
    arguments: Type.Object(
        {
            objective: Type.String({
                description: "The concrete objective to pursue until it is complete or blocked.",
            }),
        },
        { additionalProperties: false },
    ),
    returnType: Type.Object({ goal: sessionGoalSchema }),
    execute({ objective }, context) {
        if (context.goals === undefined) {
            throw new Error("Goal tracking is unavailable in this session.");
        }
        return { goal: context.goals.create({ objective }) };
    },
    toLLM: ({ goal }) => [
        {
            type: "text",
            text: `Goal created and active.\nObjective: ${goal.objective}`,
        },
    ],
    toUI: ({ goal }) => `Started goal: ${goal.objective}`,
    locks: ["goal"],
});
