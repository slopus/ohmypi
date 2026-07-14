import { afterEach, describe, expect, it } from "vitest";
import { resolve } from "node:path";

import {
    createGym,
    renderTerminalSnapshotPng,
    type Gym,
} from "../../packages/gym/sources/index.js";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("repeated background terminal polling", () => {
    it("updates one persistent timeline row while polling", async () => {
        const command = "sleep 3; printf 'POLLING_COMPLETE\\n'";
        const secondPollReady = deferred<void>();
        const startSecondPoll = deferred<void>();
        const finalPollReady = deferred<void>();
        const startFinalPoll = deferred<void>();
        let sessionId: number | undefined;
        const gym = await createGym({
            cols: 92,
            async inference(request, callIndex) {
                const lastMessage = request.context.messages.at(-1);
                if (callIndex === 0) {
                    return {
                        content: [
                            {
                                arguments: { cmd: command, yield_time_ms: 100 },
                                id: "start-polled-command",
                                name: "exec_command",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                if (callIndex === 1) {
                    sessionId = sessionIdFrom(lastMessage?.content);
                    return pollToolCall("poll-one", sessionId, 100);
                }
                if (callIndex === 2) {
                    secondPollReady.resolve();
                    await startSecondPoll.promise;
                    return pollToolCall("poll-two", sessionId, 500);
                }
                if (callIndex === 3) {
                    finalPollReady.resolve();
                    await startFinalPoll.promise;
                    return pollToolCall("poll-three", sessionId, 5_000);
                }

                expect(callIndex).toBe(4);
                expect(lastMessage).toMatchObject({ role: "toolResult", toolName: "write_stdin" });
                expect(toolResultText(lastMessage?.content)).toContain("POLLING_COMPLETE");
                return { content: [{ text: "BACKGROUND_POLLING_DONE", type: "text" }] };
            },
            rows: 28,
        });
        running.add(gym);

        gym.terminal.type("Wait for the background terminal to finish.");
        gym.terminal.press("enter");

        await secondPollReady.promise;
        const firstWait = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes(`Waited for background terminal · ${command}`) &&
                snapshot.text.includes("Ask Rig to do anything"),
            "first background terminal wait settled",
            30_000,
        );
        const waitRow = rowContaining(firstWait.rows, "Waited for background terminal");
        const composerRow = rowContaining(firstWait.rows, "Ask Rig to do anything");
        expect(countWaitRows(firstWait.rows)).toBe(1);

        startSecondPoll.resolve();
        const secondWait = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Waiting for background terminal") &&
                snapshot.text.includes("Ask Rig to do anything"),
            "second background terminal wait started",
            30_000,
        );
        expect(countWaitRows(secondWait.rows)).toBe(1);
        expect(rowContaining(secondWait.rows, "Waiting for background terminal")).toBe(waitRow);
        expect(rowContaining(secondWait.rows, "Ask Rig to do anything")).toBe(composerRow);

        await finalPollReady.promise;
        const secondWaitSettled = await gym.terminal.waitUntil(
            (snapshot) => snapshot.text.includes(`Waited for background terminal · ${command}`),
            "second background terminal wait settled",
            30_000,
        );
        expect(countWaitRows(secondWaitSettled.rows)).toBe(1);
        expect(rowContaining(secondWaitSettled.rows, "Waited for background terminal")).toBe(
            waitRow,
        );
        expect(rowContaining(secondWaitSettled.rows, "Ask Rig to do anything")).toBe(composerRow);

        startFinalPoll.resolve();
        const completed = await gym.terminal.waitForText("BACKGROUND_POLLING_DONE", 30_000);
        expect(
            completed.rows.filter((row) => row.includes("Waited for background terminal")),
        ).toHaveLength(1);
        expect(completed.text).toContain(`Waited for background terminal · ${command}`);
        expect(completed.text).not.toContain("Edited Write stdin");
        expect(completed.text).not.toContain("Checked the running shell command");
        expect(completed.text).not.toContain("The shell command has finished");
        expect(completed.text).toContain("Ask Rig to do anything");
        expect(completed.text).toContain("gym off · /workspace");
        expect(
            completed.rows.some(
                (row, index) => /^─+$/u.test(row) && /^─+$/u.test(completed.rows[index + 2] ?? ""),
            ),
        ).toBe(false);
        const completedWaitRow = completed.rows.findIndex((row) =>
            row.includes("Waited for background terminal"),
        );
        expect({
            rows: completed.rows.slice(completedWaitRow),
            waitCells: completed.cells.filter(
                (cell) => cell.y === completedWaitRow && cell.text !== " ",
            ),
        }).toMatchSnapshot("coalesced background terminal polling");
        const screenshotDirectory = process.env.RIG_GYM_SCREENSHOT_DIR;
        if (screenshotDirectory !== undefined) {
            await renderTerminalSnapshotPng(
                completed,
                resolve(screenshotDirectory, "background-terminal-polling.png"),
            );
        }
    }, 120_000);
});

function pollToolCall(id: string, sessionId: number | undefined, yieldTimeMs: number) {
    expect(sessionId).toBeTypeOf("number");
    return {
        content: [
            {
                arguments: { session_id: sessionId, yield_time_ms: yieldTimeMs },
                id,
                name: "write_stdin",
                type: "toolCall" as const,
            },
        ],
    };
}

function sessionIdFrom(content: unknown): number {
    const match = toolResultText(content).match(/Process running with session ID (\d+)/u);
    expect(match).not.toBeNull();
    return Number(match?.[1]);
}

function toolResultText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .filter(
            (block): block is { text: string; type: "text" } =>
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text" &&
                "text" in block &&
                typeof block.text === "string",
        )
        .map((block) => block.text)
        .join("");
}

function countWaitRows(rows: readonly string[]): number {
    return rows.filter(
        (row) =>
            row.includes("Waiting for background terminal") ||
            row.includes("Waited for background terminal"),
    ).length;
}

function rowContaining(rows: readonly string[], text: string): number {
    const row = rows.findIndex((candidate) => candidate.includes(text));
    expect(row).toBeGreaterThanOrEqual(0);
    return row;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value?: T) => void } {
    let resolvePromise: (value: T | PromiseLike<T>) => void = () => {};
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });
    return {
        promise,
        resolve: (value) => resolvePromise(value as T),
    };
}
