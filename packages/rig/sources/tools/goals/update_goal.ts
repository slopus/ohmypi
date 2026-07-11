import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { sessionGoalSchema } from "./goalSchemas.js";

export const updateGoalTool = defineTool({
    name: "update_goal",
    label: "update_goal",
    description: `Mark the persistent goal complete or blocked.
Use complete only when the full objective is achieved and verified with no required work remaining.
Use blocked only when meaningful progress cannot continue without user input or an external state change.
Pausing, resuming, and clearing a goal are controlled by the user.`,
    arguments: Type.Object(
        {
            status: Type.Union([Type.Literal("complete"), Type.Literal("blocked")], {
                description: "The terminal status for the current goal.",
            }),
        },
        { additionalProperties: false },
    ),
    returnType: Type.Object({ goal: sessionGoalSchema }),
    execute({ status }, context) {
        if (context.goals === undefined) {
            throw new Error("Goal tracking is unavailable in this session.");
        }
        return { goal: context.goals.update(status) };
    },
    toLLM: ({ goal }) => [
        {
            type: "text",
            text:
                goal.status === "complete"
                    ? "Goal marked complete."
                    : "Goal marked blocked. Explain the blocker and what the user needs to provide or change.",
        },
    ],
    toUI: ({ goal }) => (goal.status === "complete" ? "Completed goal" : "Blocked goal"),
    locks: ["goal"],
});
