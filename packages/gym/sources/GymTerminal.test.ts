import type { IPty } from "@lydell/node-pty";
import { describe, expect, it, vi } from "vitest";

import { GhosttyTerminal } from "./GhosttyTerminal.js";
import { GymTerminal } from "./GymTerminal.js";

describe("GymTerminal input tracking", () => {
    it("counts PTY input but not host-side output observation", () => {
        const write = vi.fn();
        const onOutput = vi.fn(() => vi.fn());
        const terminal = new GymTerminal(
            { write } as unknown as IPty,
            { onOutput } as unknown as GhosttyTerminal,
        );

        const stop = terminal.onOutput(() => {});
        expect(terminal.inputRevision).toBe(0);

        terminal.type("hello");
        terminal.press("enter");
        terminal.paste("world");
        terminal.write("\x03");

        expect(terminal.inputRevision).toBe(4);
        expect(write.mock.calls.map(([data]) => data)).toEqual([
            "hello",
            "\r",
            "\x1b[200~world\x1b[201~",
            "\x03",
        ]);
        expect(onOutput).toHaveBeenCalledOnce();
        stop();
    });
});
