import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("giant shell output is capped only in the terminal", () => {
    it("keeps the transcript bounded while sending the complete result to the model", async () => {
        const gym = await createGym({
            cols: 80,
            inference: [
                {
                    content: [
                        {
                            arguments: {
                                cmd: "printf 'MODEL_%s_HEAD_' OUTPUT; printf '%05000d' 0; printf '_MODEL_%s_SENTINEL_' MIDDLE; printf '%05000d' 0; printf '_MODEL_%s_TAIL' OUTPUT",
                            },
                            id: "giant-output",
                            name: "exec_command",
                            type: "toolCall",
                        },
                    ],
                },
                { content: [{ text: "FULL_OUTPUT_REACHED_MODEL", type: "text" }] },
                { content: [{ text: "SECOND_TURN_ACCEPTED", type: "text" }] },
            ],
            rows: 48,
        });
        running.add(gym);

        gym.terminal.type("Inspect the session database.");
        gym.terminal.press("enter");

        const firstTurn = await gym.terminal.waitForText("FULL_OUTPUT_REACHED_MODEL", 30_000);
        expect(firstTurn.rows).toHaveLength(48);
        expect(firstTurn.scroll.totalRows).toBeLessThan(80);
        expect(firstTurn.text).toContain("MODEL_OUTPUT_HEAD_");
        expect(firstTurn.text).toContain("MODEL_OUTPUT_TAIL");
        expect(firstTurn.text).toContain("output truncated");
        expect(firstTurn.text).not.toContain("MODEL_MIDDLE_SENTINEL");
        expect(firstTurn.text).not.toContain("�");

        const agentRequests = gym.inference.requests.filter(
            (request) => !request.options.sessionId?.endsWith(":title"),
        );
        expect(agentRequests).toHaveLength(2);
        const modelContext = JSON.stringify(agentRequests[1]?.context.messages);
        expect(modelContext).toContain("MODEL_OUTPUT_HEAD_");
        expect(modelContext).toContain("MODEL_MIDDLE_SENTINEL");
        expect(modelContext).toContain("MODEL_OUTPUT_TAIL");
        expect(modelContext).toContain("0".repeat(5_000));
        expect(modelContext).not.toContain("output truncated");

        gym.terminal.type("Confirm the terminal still accepts input.");
        gym.terminal.press("enter");
        const secondTurn = await gym.terminal.waitForText("SECOND_TURN_ACCEPTED", 30_000);
        expect(secondTurn.text).toContain("Ask Rig to do anything");
        expect(secondTurn.text).toContain("gym off · /workspace");
        expect(secondTurn.scroll.atBottom).toBe(true);
    }, 60_000);
});
