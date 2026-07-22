import { describe, expect, it } from "vitest";

import type { ProtocolSession } from "../protocol/index.js";
import { limitProtocolSessionMessages } from "./limitProtocolSessionMessages.js";

describe("limitProtocolSessionMessages", () => {
    it("keeps only the newest messages in a transcript-limited session response", () => {
        const session = {
            snapshot: {
                contextMessages: [{ id: "context-message" }],
                messages: Array.from({ length: 32 }, (_, index) => ({ id: `message-${index}` })),
            },
        } as unknown as ProtocolSession;

        const limited = limitProtocolSessionMessages(session, 30);

        expect(limited.snapshot.messages.map((message) => message.id)).toEqual(
            Array.from({ length: 30 }, (_, index) => `message-${index + 2}`),
        );
        expect(limited.snapshot.contextMessages).toBeUndefined();
        expect(session.snapshot.messages).toHaveLength(32);
    });
});
