import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import { selectRecentSessionEvents } from "./selectRecentSessionEvents.js";

describe("selectRecentSessionEvents", () => {
    it("starts at the oldest of the requested recent transcript messages", () => {
        const events = Array.from({ length: 32 }, (_, index) => event(index));

        const selected = selectRecentSessionEvents(events, 30);

        expect(selected.map((entry) => entry.id)).toEqual(
            Array.from({ length: 30 }, (_, index) => `event-${index + 2}`),
        );
    });

    it("retains follow-up non-message events after the transcript boundary", () => {
        const events = [event(0), event(1), event(2), statusEvent("finished")];

        expect(selectRecentSessionEvents(events, 2).map((entry) => entry.id)).toEqual([
            "event-1",
            "event-2",
            "finished",
        ]);
    });
});

function event(index: number): SessionEvent {
    return {
        createdAt: index,
        data: {
            delivery: "run",
            displayText: `message-${index}`,
            message: {
                blocks: [{ text: `message-${index}`, type: "text" }],
                id: `message-${index}`,
                role: "user",
            },
            runId: `run-${index}`,
        },
        id: `event-${index}`,
        sessionId: "session-1",
        type: "message_submitted",
    };
}

function statusEvent(id: string): SessionEvent {
    return {
        createdAt: 99,
        data: { modelLocked: false, runId: "run-2", stopReason: "stop" },
        id,
        sessionId: "session-1",
        type: "run_finished",
    };
}
