import { afterEach, describe, expect, it } from "vitest";

import { captureScrollback, createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("shell tool output preview", () => {
    it("shows at most four output rows while preserving the complete model result", async () => {
        const gym = await createGym({
            cols: 100,
            inference(request, callIndex) {
                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                arguments: {
                                    cmd: "for n in 1 2 3 4 5 6 7 8 9 10 11 12; do printf 'ROW_%02d\\n' \"$n\"; done",
                                },
                                id: "four-row-shell-preview",
                                name: "exec_command",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                const modelResult = JSON.stringify(request.context.messages.at(-1));
                for (let row = 1; row <= 12; row += 1) {
                    expect(modelResult).toContain(`ROW_${String(row).padStart(2, "0")}`);
                }
                return { content: [{ text: "FOUR_ROW_PREVIEW_DONE", type: "text" }] };
            },
            rows: 32,
        });
        running.add(gym);

        gym.terminal.type("Show the command output.");
        gym.terminal.press("enter");

        await gym.terminal.waitForText("FOUR_ROW_PREVIEW_DONE", 30_000);
        const transcript = await captureScrollback(gym);
        const lines = transcript.split("\n");
        const toolStart = lines.findIndex((line) => line.includes("Ran for n in"));
        const finalAnswer = lines.findIndex((line) => line.includes("FOUR_ROW_PREVIEW_DONE"));
        const outputRows = lines
            .slice(toolStart + 1, finalAnswer)
            .filter((line) => /ROW_\d{2}|(?:output truncated)|(?:\+\d+ lines)/u.test(line));

        expect(toolStart).toBeGreaterThanOrEqual(0);
        expect(finalAnswer).toBeGreaterThan(toolStart);
        expect(outputRows).toHaveLength(4);
        expect(outputRows.join("\n")).toContain("ROW_01");
        expect(outputRows.join("\n")).toContain("ROW_12");
        expect(outputRows.join("\n")).toMatch(/output truncated|\+\d+ lines/u);
    });
});
