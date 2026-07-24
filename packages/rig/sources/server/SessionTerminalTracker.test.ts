import { describe, expect, it } from "vitest";

import { SessionTerminalTracker } from "./SessionTerminalTracker.js";

describe("SessionTerminalTracker", () => {
    it("tracks heartbeats and explicit disconnects independently per terminal", () => {
        const tracker = new SessionTerminalTracker({
            isTargetAlive: () => true,
            sweepIntervalMs: 60_000,
        });
        try {
            tracker.heartbeat("session-1", {
                connectionId: "terminal-1",
                focused: false,
                targetPid: 101,
            });
            tracker.heartbeat("session-1", {
                connectionId: "terminal-2",
                focused: true,
                targetPid: 102,
            });

            expect(tracker.hasConnectedTerminal("session-1")).toBe(true);
            expect(tracker.hasFocusedTerminal("session-1")).toBe(true);
            expect(tracker.disconnect("session-1", "terminal-1")).toBe(true);
            expect(tracker.hasConnectedTerminal("session-1")).toBe(true);
            expect(tracker.disconnect("session-1", "terminal-2")).toBe(true);
            expect(tracker.hasConnectedTerminal("session-1")).toBe(false);
            expect(tracker.hasFocusedTerminal("session-1")).toBe(false);
        } finally {
            tracker.dispose();
        }
    });

    it("drops terminals after missed heartbeats or target process exit", () => {
        let now = 1_000;
        const alive = new Set([101, 102]);
        const tracker = new SessionTerminalTracker({
            isTargetAlive: (pid) => alive.has(pid),
            now: () => now,
            sweepIntervalMs: 60_000,
            terminalTimeoutMs: 20,
        });
        try {
            tracker.heartbeat("timed-out", {
                connectionId: "terminal-1",
                focused: false,
                targetPid: 101,
            });
            tracker.heartbeat("exited", {
                connectionId: "terminal-2",
                focused: false,
                targetPid: 102,
            });
            alive.delete(102);

            expect(tracker.hasConnectedTerminal("exited")).toBe(false);
            now += 21;
            expect(tracker.hasConnectedTerminal("timed-out")).toBe(false);
        } finally {
            tracker.dispose();
        }
    });
});
