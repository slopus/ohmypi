import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("exploration command rendering", () => {
    it("renders list, search, and read commands as one structured Explored block", async () => {
        const gym = await createGym({
            files: {
                "src/example.ts": "export const needle = 42;\n",
            },
            inference: [
                {
                    content: [
                        {
                            arguments: {
                                cmd: "rg --files src | head -n 20; rg -n needle src; sed -n '1,20p' src/example.ts",
                            },
                            id: "explore-source",
                            name: "exec_command",
                            type: "toolCall",
                        },
                    ],
                },
                { content: [{ text: "Inspection complete.", type: "text" }] },
            ],
            rows: 40,
        });
        running.add(gym);

        gym.terminal.type("Inspect the source tree.");
        gym.terminal.press("enter");

        const completed = await gym.terminal.waitForText("Inspection complete.", 30_000);
        expect(completed.text).toContain("• Explored");
        expect(completed.text).toContain("└ List src");
        expect(completed.text).toContain("Search needle in src");
        expect(completed.text).toContain("Read example.ts");
        expect(completed.text).not.toContain("• Ran rg --files");
        expect(completed.text).not.toContain("export const needle = 42");
    });
});
