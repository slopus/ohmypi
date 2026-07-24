import { describe, expect, it } from "vitest";

import type { SessionSummary } from "../protocol/index.js";
import { SessionTerminalTracker } from "./SessionTerminalTracker.js";
import { sessionSummaryWithTerminalPresence } from "./sessionSummaryWithTerminalPresence.js";

describe("sessionSummaryWithTerminalPresence", () => {
    it("shows settled disconnected sessions as idle or archived according to their flag", () => {
        const tracker = new SessionTerminalTracker({
            isTargetAlive: () => true,
            sweepIntervalMs: 60_000,
        });
        try {
            expect(
                sessionSummaryWithTerminalPresence(summary({ archiveOnIdle: false }), tracker)
                    .status,
            ).toBe("idle");
            expect(
                sessionSummaryWithTerminalPresence(summary({ archiveOnIdle: true }), tracker)
                    .status,
            ).toBe("archived");
        } finally {
            tracker.dispose();
        }
    });

    it("retains intrinsic status while connected or actively running", () => {
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
            expect(sessionSummaryWithTerminalPresence(summary(), tracker).status).toBe("completed");

            tracker.disconnect("session-1", "terminal-1");
            expect(
                sessionSummaryWithTerminalPresence(summary({ status: "running" }), tracker).status,
            ).toBe("running");
        } finally {
            tracker.dispose();
        }
    });

    it("suppresses unread state while any live client is focused", () => {
        const tracker = new SessionTerminalTracker({
            isTargetAlive: () => true,
            sweepIntervalMs: 60_000,
        });
        try {
            tracker.heartbeat("session-1", {
                connectionId: "background",
                focused: false,
                targetPid: 101,
            });
            const unread = { reason: "turn_finished" as const, since: 10 };
            expect(sessionSummaryWithTerminalPresence(summary({ unread }), tracker).unread).toEqual(
                unread,
            );

            tracker.heartbeat("session-1", {
                connectionId: "foreground",
                focused: true,
                targetPid: 102,
            });
            expect(
                sessionSummaryWithTerminalPresence(summary({ unread }), tracker).unread,
            ).toBeUndefined();
        } finally {
            tracker.dispose();
        }
    });
});

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        archiveOnIdle: false,
        createdAt: 1,
        cwd: "/workspace",
        id: "session-1",
        modelId: "openai/gpt-5.5",
        permissionMode: "workspace_write",
        providerId: "codex",
        status: "completed",
        titleStatus: "ready",
        updatedAt: 2,
        ...overrides,
    };
}
