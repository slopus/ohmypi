import { describe, expect, it } from "vitest";

import { captureScrollback, createGym, type Gym } from "@slopus/rig-gym";

type TerminalSnapshot = Awaited<ReturnType<Gym["terminal"]["snapshot"]>>;

describe("queued prompt drain", () => {
    it("replaces the queued row with user history without an intermediate composer jump", async () => {
        const releaseInference = deferred<void>();
        const queuedPrompt = "DRAINED_QUEUE_PROMPT";
        const gym = await createGym({
            cols: 88,
            async inference(request, callIndex) {
                if (callIndex === 0) {
                    await releaseInference.promise;
                    return {
                        content: [
                            {
                                arguments: { cmd: "printf 'DRAIN_BOUNDARY_RAN\\n'" },
                                id: "drain-boundary",
                                name: "exec_command",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                expect(callIndex).toBe(1);
                expect(userTexts(request.context.messages)).toContain(queuedPrompt);
                return { content: [{ text: "DRAIN_COMPLETE", type: "text" }] };
            },
            rows: 28,
        });

        try {
            submit(gym, "Hold this turn until a queued prompt is ready.");
            await gym.terminal.waitForText("esc to interrupt", 30_000);
            submit(gym, queuedPrompt);
            const pending = await gym.terminal.waitUntil(
                (snapshot) =>
                    snapshot.text.includes("Messages to be submitted after next tool call") &&
                    snapshot.text.includes(`└ ${queuedPrompt}`) &&
                    snapshot.text.includes("Ask Rig to do anything"),
                "the queued prompt above the composer",
                30_000,
            );
            const pendingComposerRow = rowContaining(pending.rows, "Ask Rig to do anything");

            const framePromises: Promise<TerminalSnapshot>[] = [];
            const stopCapturing = gym.terminal.onOutput(() => {
                framePromises.push(gym.terminal.snapshot());
            });
            releaseInference.resolve();
            const completed = await gym.terminal.waitUntil(
                (snapshot) =>
                    snapshot.text.includes("DRAIN_COMPLETE") &&
                    snapshot.rows.some((row) => row.trim() === `› ${queuedPrompt}`) &&
                    snapshot.text.includes("Ask Rig to do anything") &&
                    snapshot.scroll.atBottom,
                "the drained prompt in history and the completed run",
                30_000,
            );
            stopCapturing();

            const frames = await Promise.all(framePromises);
            expect(frames.length).toBeGreaterThan(0);
            expect(
                frames.some((frame) =>
                    frame.rows.some((row) => row.trim() === `› ${queuedPrompt}`),
                ),
            ).toBe(true);
            for (const frame of frames) {
                const queuedVisible = frame.rows.some((row) => row.includes(`└ ${queuedPrompt}`));
                const historyVisible = frame.rows.some((row) => row.trim() === `› ${queuedPrompt}`);
                expect(queuedVisible || historyVisible).toBe(true);

                const composerRow = frame.rows.findIndex((row) =>
                    row.includes("Ask Rig to do anything"),
                );
                if (composerRow >= 0)
                    expect(composerRow).toBeGreaterThanOrEqual(pendingComposerRow);
            }

            expect(completed.text).not.toContain("Messages to be submitted after next tool call");
            expect(completed.rows.filter((row) => row.trim() === `› ${queuedPrompt}`)).toHaveLength(
                1,
            );
            const scrollback = await captureScrollback(gym);
            expect(
                scrollback.split("\n").filter((row) => row.trim() === `› ${queuedPrompt}`),
            ).toHaveLength(1);
        } finally {
            releaseInference.resolve();
            await gym.dispose();
        }
    }, 120_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}

function rowContaining(rows: readonly string[], text: string): number {
    const row = rows.findIndex((candidate) => candidate.includes(text));
    expect(row).toBeGreaterThanOrEqual(0);
    return row;
}

function userTexts(messages: readonly { content: unknown; role: string }[]): string[] {
    return messages.flatMap((message) => {
        if (message.role !== "user") return [];
        if (typeof message.content === "string") return [message.content];
        if (!Array.isArray(message.content)) return [];
        return message.content.flatMap((block) => {
            if (
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text" &&
                "text" in block &&
                typeof block.text === "string"
            ) {
                return [block.text];
            }
            return [];
        });
    });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value?: T) => void } {
    let resolvePromise: (value: T | PromiseLike<T>) => void = () => {};
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: (value) => resolvePromise(value as T) };
}
