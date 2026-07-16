import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import { resolveSteeringContinuationMessageIds } from "./resolveSteeringContinuationMessageIds.js";

describe("resolveSteeringContinuationMessageIds", () => {
    it("accepts pending and applied user steering in requested FIFO order", () => {
        expect(
            resolveSteeringContinuationMessageIds({
                events: [
                    submitted("applied", "run-1"),
                    applied("applied", "run-1"),
                    submitted("pending", "run-1"),
                ],
                pendingMessageIds: new Set(["pending"]),
                requestedMessageIds: ["applied", "pending"],
                runId: "run-1",
            }),
        ).toEqual(["applied", "pending"]);
    });

    it.each([
        {
            events: [submitted("wrong-run", "run-2"), applied("wrong-run", "run-2")],
            label: "wrong-run steering",
            messageId: "wrong-run",
        },
        {
            events: [
                submitted("notification", "run-1", "notification"),
                applied("notification", "run-1"),
            ],
            label: "notification steering",
            messageId: "notification",
        },
        {
            events: [submitted("unaccepted", "run-1")],
            label: "neither pending nor applied steering",
            messageId: "unaccepted",
        },
    ])("rejects $label", ({ events, messageId }) => {
        expect(
            resolveSteeringContinuationMessageIds({
                events,
                pendingMessageIds: new Set(),
                requestedMessageIds: [messageId],
                runId: "run-1",
            }),
        ).toBeUndefined();
    });
});

function submitted(messageId: string, runId: string, source?: "notification"): SessionEvent {
    return {
        createdAt: 1,
        data: {
            delivery: "steer",
            displayText: messageId,
            message: {
                blocks: [{ text: messageId, type: "text" }],
                id: messageId,
                role: "user",
            },
            runId,
            ...(source === undefined ? {} : { source }),
        },
        id: `submitted-${messageId}`,
        sessionId: "session-1",
        type: "message_submitted",
    };
}

function applied(messageId: string, runId: string): SessionEvent {
    return {
        createdAt: 2,
        data: { messageIds: [messageId], runId },
        id: `applied-${messageId}`,
        sessionId: "session-1",
        type: "steering_applied",
    };
}
