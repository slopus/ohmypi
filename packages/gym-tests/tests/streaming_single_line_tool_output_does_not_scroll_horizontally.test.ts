import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("streaming single-line tool output", () => {
    it("keeps the visible beginning stable as more output arrives", async () => {
        const command = [
            "printf 'TELEPROMPTER_HEAD_'",
            "i=0",
            "while [ $i -lt 24 ]; do printf '%04d:%0120d' $i 0; sleep 0.05; i=$((i + 1)); done",
            "sleep 3",
            "printf '\\nSTREAM_FINISHED\\n'",
        ].join("; ");
        const gym = await createGym({
            cols: 80,
            environment: { RIG_GYM_RUNTIME: "node" },
            inference: [
                {
                    content: [
                        {
                            arguments: { cmd: command },
                            id: "streaming-single-line-output",
                            name: "exec_command",
                            type: "toolCall",
                        },
                    ],
                },
                { content: [{ text: "STREAMING_OUTPUT_COMPLETE", type: "text" }] },
            ],
            rows: 20,
        });
        running.add(gym);

        gym.terminal.type("Run the streaming output command.");
        gym.terminal.press("enter");

        const early = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("• Running printf") &&
                progressRow(snapshot.rows).includes("TELEPROMPTER_HEAD_0000:") &&
                snapshot.scroll.atBottom,
            "the beginning of the single-line output",
            30_000,
        );
        const earlyProgressRow = progressRow(early.rows);
        expect(earlyProgressRow).not.toContain("0008:");

        const late = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("• Running printf") &&
                snapshot.text.includes("(2s · esc to interrupt)") &&
                snapshot.scroll.atBottom,
            "the same command after its progress tail exceeds 2,000 characters",
            30_000,
        );
        expect(progressRow(late.rows)).toBe(earlyProgressRow);

        const completed = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("STREAM_FINISHED") &&
                snapshot.text.includes("STREAMING_OUTPUT_COMPLETE") &&
                snapshot.text.includes("Ask Rig to do anything") &&
                snapshot.scroll.atBottom,
            "the completed command and idle composer",
            30_000,
        );
        expect(completed.text).not.toContain("�");
    }, 60_000);
});

function progressRow(rows: readonly string[]): string {
    return rows.find((row) => row.trimStart().startsWith("└")) ?? "";
}
