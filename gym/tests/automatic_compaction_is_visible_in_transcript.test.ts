import { afterEach, describe, expect, it } from "vitest";
import { resolve } from "node:path";

import {
    createGym,
    renderTerminalSnapshotPng,
    type Gym,
    type TerminalSnapshot,
} from "../../packages/gym/sources/index.js";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("automatic conversation compaction", () => {
    it("shows a durable transcript row when a small context window triggers compaction", async () => {
        const gym = await createGym({
            cols: 92,
            contextWindow: 500,
            inference(request, callIndex) {
                const isCompaction = request.context.systemPrompt?.startsWith(
                    "Create a detailed continuation brief",
                );
                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                text: `Loaded a large working context.\n\n${"context detail ".repeat(180)}`,
                                type: "text",
                            },
                        ],
                        delayMs: 3_000,
                    };
                }
                if (callIndex === 1) {
                    expect(isCompaction).toBe(true);
                    return {
                        content: [{ text: "The earlier context was summarized.", type: "text" }],
                    };
                }
                expect(callIndex).toBe(2);
                expect(isCompaction).toBe(false);
                return { content: [{ text: "Continued with compacted context.", type: "text" }] };
            },
            rows: 26,
        });
        running.add(gym);

        submit(gym, "Load enough detail to fill the context.");
        await gym.terminal.waitForText("Working", 30_000);
        gym.terminal.type("Continue from that work.");
        await gym.terminal.waitForText("› Continue from that work.", 30_000);
        gym.terminal.press("tab");
        await gym.terminal.waitForText("↳ queued Continue from that work.", 30_000);

        const snapshot = await gym.terminal.waitUntil(
            (candidate) =>
                candidate.text.includes("Context compacted") &&
                candidate.text.includes("Continued with compacted context.") &&
                candidate.scroll.atBottom,
            "a visible automatic compaction row",
            30_000,
        );
        expect(snapshot.text).toMatch(
            /Summarized \d+ older messages; [\d.]+k? → [\d.]+k? tokens\./u,
        );
        await captureReviewImage(snapshot, "automatic-compaction-visible.png");
    }, 120_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}

async function captureReviewImage(snapshot: TerminalSnapshot, fileName: string): Promise<void> {
    const directory = process.env.RIG_GYM_SCREENSHOT_DIR;
    if (directory === undefined) return;
    await renderTerminalSnapshotPng(snapshot, resolve(directory, fileName));
}
