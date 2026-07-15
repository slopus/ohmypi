import { describe, expect, it, vi } from "vitest";

import type { SessionEvent } from "../protocol/index.js";
import { SessionEventLog } from "./SessionEventLog.js";

const FIRST = "018bcfe5-6800-7001-8000-000000000001";
const OMITTED = "018bcfe5-6800-7002-8000-000000000002";
const DURABLE = "018bcfe5-6800-7003-8000-000000000003";
const TRAILING = "018bcfe5-6800-7004-8000-000000000004";
const FUTURE = "018bcfe5-6800-7005-8000-000000000005";

describe("SessionEventLog", () => {
    it("recovers an omitted ordered cursor without replaying its durable predecessor", () => {
        const log = new SessionEventLog({
            events: [event(FIRST)],
            lastEventId: OMITTED,
        });
        log.append(event(DURABLE));

        expect(log.since(OMITTED)?.map((entry) => entry.id)).toEqual([DURABLE]);
        expect(log.since(DURABLE)).toEqual([]);
    });

    it("rejects cursors that were not omitted from this session", () => {
        const log = new SessionEventLog({
            events: [event(FIRST), event(DURABLE)],
            lastEventId: TRAILING,
        });

        expect(log.since("not-an-event-id")).toBeUndefined();
        expect(log.since("018bcfe5-6800-7000-8000-000000000000")).toBeUndefined();
        expect(log.since(OMITTED)).toBeUndefined();
        expect(log.since(FUTURE)).toBeUndefined();
    });

    it("updates the cursor high-water while delivering appended events to subscribers", () => {
        const listener = vi.fn();
        const log = new SessionEventLog({ events: [event(FIRST)] });
        log.subscribe(listener);

        log.append(event(DURABLE));

        expect(log.lastEventId()).toBe(DURABLE);
        expect(listener).toHaveBeenCalledExactlyOnceWith(event(DURABLE));
    });
});

function event(id: string): SessionEvent {
    return {
        createdAt: 1_700_000_000_000,
        data: {
            snapshot: {
                id: "agent-1",
                messages: [],
                modelId: "openai/gpt-5.5",
                providerId: "codex",
                queue: [],
                status: "idle",
                tools: [],
            },
        },
        id,
        sessionId: "session-1",
        type: "session_reset",
    };
}
