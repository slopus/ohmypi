import { describe, expect, it } from "vitest";

import { createEventIdFactory } from "./createEventIdFactory.js";

describe("createEventIdFactory", () => {
    it("creates lexicographically time-ordered ids", () => {
        let now = 1_700_000_000_000;
        const createId = createEventIdFactory({ now: () => now });

        const first = createId();
        const second = createId();
        now += 1;
        const third = createId();

        expect([third, first, second].sort()).toEqual([first, second, third]);
        expect(first).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
        );
    });

    it("continues after a persisted cursor when the clock moves backward", () => {
        const persisted = "018bcfe5-6800-7fff-8000-000000000001";
        const createId = createEventIdFactory({
            after: persisted,
            now: () => 1,
        });

        expect(createId() > persisted).toBe(true);
    });

    it("ignores malformed persisted cursors", () => {
        const createId = createEventIdFactory({ after: "legacy-event-id", now: () => 1 });

        expect(createId()).toMatch(/^00000000-0001-7[0-9a-f]{3}-/u);
    });
});
