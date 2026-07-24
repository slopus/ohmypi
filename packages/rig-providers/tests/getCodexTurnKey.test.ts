import { describe, expect, it } from "vitest";

import type { SessionMessage } from "@/core/SessionContext.js";
import { getCodexTurnKey } from "@/vendors/codex/impl/getCodexTurnKey.js";

describe("getCodexTurnKey", () => {
    it("keeps one turn across continuations after a triggering native agent message", () => {
        const task: SessionMessage = {
            role: "agent",
            author: "/root",
            recipient: "/root/child",
            header: "Message Type: NEW_TASK\nPayload:\n",
            encryptedContent: "opaque-task",
            agentMessageTriggerTurn: true,
        };

        expect(getCodexTurnKey([task])).toBe(
            getCodexTurnKey([
                task,
                { role: "assistant", content: "Working." },
                { role: "tool", callId: "call-1", content: "done" },
            ]),
        );
    });

    it("does not treat a queued native agent message as a new turn", () => {
        const human: SessionMessage = { role: "user", content: "Original task" };
        const queued: SessionMessage = {
            role: "agent",
            author: "/root",
            recipient: "/root/child",
            header: "Message Type: MESSAGE\nPayload:\n",
            encryptedContent: "opaque-message",
        };

        expect(getCodexTurnKey([human, queued])).toBe(getCodexTurnKey([human]));
    });
});
