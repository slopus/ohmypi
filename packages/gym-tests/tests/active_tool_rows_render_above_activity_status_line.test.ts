import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("active work ordering", () => {
    it("renders active tool rows above the activity status line and composer", async () => {
        const gym = await createGym({
            cols: 96,
            inference(request, callIndex) {
                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                arguments: { cmd: "sleep 60", yield_time_ms: 30_000 },
                                id: "tool-sleep-a",
                                name: "exec_command",
                                type: "toolCall",
                            },
                            {
                                arguments: { cmd: "sleep 60", yield_time_ms: 30_000 },
                                id: "tool-sleep-b",
                                name: "exec_command",
                                type: "toolCall",
                            },
                        ],
                    };
                }
                return { content: [{ text: "TOOLS_SETTLED", type: "text" }] };
            },
            rows: 32,
        });
        running.add(gym);

        gym.terminal.type("Run two slow commands in parallel.");
        gym.terminal.press("enter");

        const snapshot = await gym.terminal.waitUntil(
            (state) =>
                state.text.includes("esc to interrupt") &&
                state.text.includes("Ask Rig to do anything") &&
                state.rows.filter((row) => row.includes("sleep 60")).length === 2,
            "two active tool rows with the activity status line",
            30_000,
        );

        const activityRow = snapshot.rows.findIndex((row) => row.includes("esc to interrupt"));
        const composerRow = snapshot.rows.findIndex((row) =>
            row.includes("Ask Rig to do anything"),
        );
        const toolRows = snapshot.rows
            .map((row, index) => ({ index, row }))
            .filter(({ row }) => row.includes("sleep 60"))
            .map(({ index }) => index);

        expect(activityRow).toBeGreaterThanOrEqual(0);
        expect(composerRow).toBeGreaterThanOrEqual(0);
        expect(toolRows).toHaveLength(2);
        for (const toolRow of toolRows) {
            expect(toolRow).toBeLessThan(activityRow);
        }
        expect(activityRow).toBeLessThan(composerRow);
    }, 120_000);
});
