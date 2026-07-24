import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const rig = "node /app/packages/rig/dist/main.js";
const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("session terminal presence", () => {
    it("reports a completed open TUI session and archives it when the terminal disconnects", async () => {
        const gym = await createGym({
            entrypoint: [
                "bash",
                "-lc",
                [rig, "echo TERMINAL_DISCONNECTED", `${rig} monit`, "read -r _"].join("; "),
            ],
            inference: [
                {
                    content: [{ text: "THE_SESSION_COMPLETED", type: "text" }],
                },
            ],
            mode: "docker",
        });
        running.add(gym);

        gym.terminal.type("Complete this turn.");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("THE_SESSION_COMPLETED", 30_000);

        const whileConnected = await gym.runInContainer("node", [
            "/app/packages/rig/dist/main.js",
            "monit",
        ]);
        expect(whileConnected.stdout).toMatch(/^Completed\s+/m);

        gym.terminal.press("ctrlD");
        const afterDisconnect = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("TERMINAL_DISCONNECTED") &&
                /^Archived\s+/m.test(snapshot.text),
            "the disconnected TUI session to appear archived",
            30_000,
        );
        expect(afterDisconnect.text).not.toMatch(/^Completed\s+/m);
    }, 60_000);
});
