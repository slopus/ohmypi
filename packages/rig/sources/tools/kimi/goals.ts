import { createGoalTool, getGoalTool, updateGoalTool } from "../goals/index.js";
import {
    KIMI_CREATE_GOAL_DESCRIPTION,
    KIMI_GET_GOAL_DESCRIPTION,
    KIMI_UPDATE_GOAL_DESCRIPTION,
} from "./kimiToolDescriptions.js";
import { withKimiToolContract } from "./withKimiToolContract.js";

export const kimiCreateGoalTool = withKimiToolContract(createGoalTool, {
    argumentDescriptions: {
        objective: "Concrete long-running objective with a checkable completion state.",
    },
    description: KIMI_CREATE_GOAL_DESCRIPTION,
    label: "CreateGoal",
    name: "CreateGoal",
});

export const kimiGetGoalTool = withKimiToolContract(getGoalTool, {
    description: KIMI_GET_GOAL_DESCRIPTION,
    label: "GetGoal",
    name: "GetGoal",
});

export const kimiUpdateGoalTool = withKimiToolContract(updateGoalTool, {
    argumentDescriptions: {
        status: "Terminal goal status: complete or blocked.",
    },
    description: KIMI_UPDATE_GOAL_DESCRIPTION,
    label: "UpdateGoal",
    name: "UpdateGoal",
});

export const kimiGoalTools = [kimiCreateGoalTool, kimiGetGoalTool, kimiUpdateGoalTool] as const;
