export { createGoalTool } from "./create_goal.js";
export { getGoalTool } from "./get_goal.js";
export { updateGoalTool } from "./update_goal.js";

import { createGoalTool } from "./create_goal.js";
import { getGoalTool } from "./get_goal.js";
import { updateGoalTool } from "./update_goal.js";

export const goalTools = [createGoalTool, getGoalTool, updateGoalTool] as const;
