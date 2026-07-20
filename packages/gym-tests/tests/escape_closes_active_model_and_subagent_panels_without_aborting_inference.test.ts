import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("Escape in active response panels", () => {
    it("closes the model and subagent panels without aborting inference", async () => {
        const responses = ["MODEL_RESPONSE_FINISHED", "SUBAGENT_RESPONSE_FINISHED"];
        const gym = await createGym({
            inference(_request, callIndex) {
                const response = responses[callIndex];
                if (response === undefined) {
                    throw new Error(`Unexpected inference call ${String(callIndex)}`);
                }
                return {
                    content: [{ text: response, type: "text" }],
                    delayMs: 1_500,
                };
            },
        });
        running.add(gym);

        submit(gym, "Keep running while I inspect the model list.");
        await gym.terminal.waitForText("Working", 30_000);
        submit(gym, "/model");
        await gym.terminal.waitForText("Choose Model", 30_000);

        gym.terminal.press("escape");

        const modelResponse = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("MODEL_RESPONSE_FINISHED") &&
                !snapshot.text.includes("Choose Model"),
            "the model panel to close without aborting the active response",
            30_000,
        );
        expect(modelResponse.text).not.toContain("Interrupted");

        submit(gym, "Keep running while I inspect the subagent list.");
        await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Keep running while I inspect the subagent list.") &&
                snapshot.text.includes("Working"),
            "the second response to start",
            30_000,
        );
        submit(gym, "/agents");
        const subagentPanel = await gym.terminal.waitForText("Subagents", 30_000);
        expect(subagentPanel.text).toContain("0 delegated tasks");

        gym.terminal.press("escape");

        const subagentResponse = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("SUBAGENT_RESPONSE_FINISHED") &&
                !snapshot.text.includes("0 delegated tasks"),
            "the subagent panel to close without aborting the active response",
            30_000,
        );
        expect(subagentResponse.text).not.toContain("Interrupted");

        const requests = gym.inference.requests.filter(
            (request) => !request.options.sessionId?.endsWith(":title"),
        );
        expect(requests).toHaveLength(2);
    }, 90_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}
