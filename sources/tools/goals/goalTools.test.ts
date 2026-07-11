import { describe, expect, it } from "vitest";

import type { SessionGoal } from "../../goals/index.js";
import { createJustBashToolHarness } from "../testing/createJustBashToolHarness.js";
import { createGoalTool } from "./create_goal.js";
import { getGoalTool } from "./get_goal.js";
import { updateGoalTool } from "./update_goal.js";

describe("goal tools", () => {
    it("creates, reads, and completes a persistent goal", async () => {
        const harness = createJustBashToolHarness();
        let goal: SessionGoal | undefined;
        harness.context.goals = {
            create: ({ objective }) => {
                goal = { createdAt: 1, objective, status: "active", updatedAt: 1 };
                return { ...goal };
            },
            get: () => (goal === undefined ? undefined : { ...goal }),
            update: (status) => {
                if (goal === undefined) throw new Error("No goal");
                goal = { ...goal, status, updatedAt: 2 };
                return { ...goal };
            },
        };

        await expect(
            harness.runTool(createGoalTool, { objective: "Ship the complete feature" }),
        ).resolves.toMatchObject({ goal: { status: "active" } });
        await expect(harness.runTool(getGoalTool, {})).resolves.toMatchObject({
            goal: { objective: "Ship the complete feature" },
        });
        await expect(
            harness.runTool(updateGoalTool, { status: "complete" }),
        ).resolves.toMatchObject({ goal: { status: "complete" } });
    });
});
