import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import { findLegacyOrphanedSteering } from "./findLegacyOrphanedSteering.js";

describe("findLegacyOrphanedSteering", () => {
    it("returns only unapplied steer submissions followed by their own terminal boundary", () => {
        const orphaned = steerSubmitted("orphaned", "run-1", 1);
        const applied = steerSubmitted("applied", "run-1", 2);
        const stillRunning = steerSubmitted("still-running", "run-2", 3);
        const notification = steerSubmitted("notification", "run-1", 4, "notification");
        const reusedInAnotherRun = steerSubmitted("applied", "run-3", 7);
        const events: SessionEvent[] = [
            orphaned,
            applied,
            stillRunning,
            notification,
            event("steering_applied", 5, {
                messageIds: [applied.data.message.id],
                runId: "run-1",
            }),
            event("run_finished", 6, {
                agentRunId: "agent-run-1",
                modelLocked: true,
                runId: "run-1",
                stopReason: "aborted",
            }),
            event("run_finished", 7, {
                agentRunId: "agent-run-other",
                modelLocked: true,
                runId: "run-other",
                stopReason: "stop",
            }),
            reusedInAnotherRun,
            event("run_finished", 8, {
                agentRunId: "agent-run-3",
                modelLocked: true,
                runId: "run-3",
                stopReason: "stop",
            }),
        ];

        expect(findLegacyOrphanedSteering(events)).toEqual([
            { events: [orphaned, notification], runId: "run-1" },
            { events: [reusedInAnotherRun], runId: "run-3" },
        ]);
    });

    it("recognizes run errors and ignores submissions after an earlier boundary", () => {
        const beforeError = steerSubmitted("before-error", "run-error", 1);
        const afterBoundary = steerSubmitted("after-boundary", "run-finished", 4);
        const events: SessionEvent[] = [
            beforeError,
            event("run_error", 2, {
                errorMessage: "legacy failure",
                modelLocked: true,
                runId: "run-error",
            }),
            event("run_finished", 3, {
                agentRunId: "agent-run-finished",
                modelLocked: true,
                runId: "run-finished",
                stopReason: "stop",
            }),
            afterBoundary,
        ];

        expect(findLegacyOrphanedSteering(events)).toEqual([
            { events: [beforeError], runId: "run-error" },
        ]);
    });
});

function steerSubmitted(
    messageId: string,
    runId: string,
    createdAt: number,
    source?: "notification",
): Extract<SessionEvent, { type: "message_submitted" }> {
    return event("message_submitted", createdAt, {
        delivery: "steer",
        displayText: messageId,
        message: {
            blocks: [{ text: messageId, type: "text" }],
            id: messageId,
            role: "user",
        },
        runId,
        ...(source === undefined ? {} : { source }),
    });
}

function event<TType extends SessionEvent["type"]>(
    type: TType,
    createdAt: number,
    data: Extract<SessionEvent, { type: TType }>["data"],
): Extract<SessionEvent, { type: TType }> {
    return {
        createdAt,
        data,
        id: `event-${String(createdAt)}`,
        sessionId: "session-1",
        type,
    } as Extract<SessionEvent, { type: TType }>;
}
