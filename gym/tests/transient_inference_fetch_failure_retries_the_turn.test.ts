import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "../../packages/gym/sources/index.js";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("transient inference failures", () => {
    it("retries a disconnected fetch without ending the turn", async () => {
        const gym = await createGym({
            inference(_request, callIndex) {
                if (callIndex === 0) return { disconnect: true };
                expect(callIndex).toBe(1);
                return { content: [{ text: "RETRY_RECOVERED", type: "text" }] };
            },
        });
        running.add(gym);

        gym.terminal.type("Recover this turn without asking me to continue.");
        gym.terminal.press("enter");

        const completed = await gym.terminal.waitForText("RETRY_RECOVERED", 30_000);
        expect(completed.text).not.toContain("Error fetch failed");
        expect(
            gym.inference.requests.filter(
                (request) => request.options.sessionId?.endsWith(":title") !== true,
            ),
        ).toHaveLength(2);
        expect(completed.text).toContain("Ask Rig to do anything");
    }, 120_000);

    it("retries the generic Codex request-id error before content starts", async () => {
        const retryableCodexError =
            "Codex error: An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 959fcb61-d6b8-42d8-b224-e11bc88333d8 in your message.";
        const gym = await createGym({
            inference(_request, callIndex) {
                if (callIndex === 0) {
                    return {
                        content: [],
                        errorMessage: retryableCodexError,
                        stopReason: "error",
                    };
                }
                expect(callIndex).toBe(1);
                return { content: [{ text: "CODEX_RETRY_RECOVERED", type: "text" }] };
            },
        });
        running.add(gym);

        gym.terminal.type("Recover from the generic Codex error.");
        gym.terminal.press("enter");

        const completed = await gym.terminal.waitForText("CODEX_RETRY_RECOVERED", 30_000);
        expect(completed.text).not.toContain(retryableCodexError);
        expect(
            gym.inference.requests.filter(
                (request) => request.options.sessionId?.endsWith(":title") !== true,
            ),
        ).toHaveLength(2);
        expect(completed.text).toContain("Ask Rig to do anything");
    }, 120_000);
});
