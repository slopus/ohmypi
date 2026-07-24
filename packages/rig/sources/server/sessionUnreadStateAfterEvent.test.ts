import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import { sessionUnreadStateAfterEvent } from "./sessionUnreadStateAfterEvent.js";

describe("sessionUnreadStateAfterEvent", () => {
    it("marks questions as attention needed and completed turns as finished", () => {
        expect(sessionUnreadStateAfterEvent(undefined, event("user_input_requested"))).toEqual({
            reason: "attention_needed",
            since: 10,
        });
        expect(sessionUnreadStateAfterEvent(undefined, event("run_finished"))).toEqual({
            reason: "turn_finished",
            since: 10,
        });
    });

    it("does not let a later turn boundary obscure unread attention", () => {
        const attention = { reason: "attention_needed", since: 5 } as const;

        expect(sessionUnreadStateAfterEvent(attention, event("run_error"))).toEqual(attention);
        expect(sessionUnreadStateAfterEvent(attention, event("session_updated"))).toEqual(
            attention,
        );
    });
});

function event(type: SessionEvent["type"]): SessionEvent {
    return {
        createdAt: 10,
        data: {},
        id: "event-1",
        sessionId: "session-1",
        type,
    } as SessionEvent;
}
