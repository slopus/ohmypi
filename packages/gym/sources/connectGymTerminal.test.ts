import { describe, expect, it } from "vitest";

import { connectGymTerminal } from "./connectGymTerminal.js";

describe("connectGymTerminal", () => {
    it("ignores PTY output that arrives after the connection is disposed", () => {
        let onData: ((data: string) => void) | undefined;
        let subscriptionDisposed = false;
        const terminalWrites: string[] = [];
        const disconnect = connectGymTerminal(
            {
                onData(handler) {
                    onData = handler;
                    return {
                        dispose() {
                            subscriptionDisposed = true;
                        },
                    };
                },
                write() {},
            },
            {
                onPtyWrite() {
                    return () => {};
                },
                write(data) {
                    terminalWrites.push(data);
                },
            },
        );

        onData?.("before disposal");
        disconnect();
        expect(subscriptionDisposed).toBe(true);
        expect(() => onData?.("late output")).not.toThrow();
        expect(terminalWrites).toEqual(["before disposal"]);
    });
});
