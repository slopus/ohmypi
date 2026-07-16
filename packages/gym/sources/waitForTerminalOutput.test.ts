import { describe, expect, it, vi } from "vitest";

import { waitForTerminalOutput } from "./waitForTerminalOutput.js";

describe("waitForTerminalOutput", () => {
    it("resolves after the expected text spans output chunks and removes its listener", async () => {
        let listener: ((data: string) => void) | undefined;
        const stop = vi.fn();
        const gym = {
            terminal: {
                onOutput(callback: (data: string) => void) {
                    listener = callback;
                    return stop;
                },
            },
        };
        const waiting = waitForTerminalOutput(gym, "expected text", 1_000);

        listener?.("expected ");
        listener?.("text");

        await expect(waiting).resolves.toBeUndefined();
        expect(stop).toHaveBeenCalledOnce();
    });
});
