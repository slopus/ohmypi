import type { SessionEvent, SessionTokenCount } from "../protocol/index.js";
import { updateSessionTokenCount } from "./updateSessionTokenCount.js";

export function sessionTokenCountAfterEvent(
    current: SessionTokenCount | undefined,
    event: SessionEvent,
): SessionTokenCount | undefined {
    if (event.type === "session_reset") {
        return updateSessionTokenCount(current, { type: "reset" });
    }
    if (event.type === "agent_event" && event.data.event.type === "context_compacted") {
        return updateSessionTokenCount(current, {
            type: "compaction",
            contextTokens: event.data.event.estimatedTokensAfter,
        });
    }
    if (
        event.type === "agent_message" &&
        event.data.message.role === "agent" &&
        event.data.message.usage !== undefined
    ) {
        return updateSessionTokenCount(current, {
            type: "usage",
            usage: event.data.message.usage,
        });
    }
    return current;
}
