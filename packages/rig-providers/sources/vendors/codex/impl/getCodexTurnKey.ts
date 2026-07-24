import type { SessionMessage } from "@/core/SessionContext.js";

export function getCodexTurnKey(messages: readonly SessionMessage[]): string {
    const lastTurnBoundaryIndex = messages.findLastIndex(
        (message) =>
            message.role === "user" ||
            (message.role === "agent" && message.agentMessageTriggerTurn === true),
    );
    return JSON.stringify(
        messages.slice(0, lastTurnBoundaryIndex < 0 ? messages.length : lastTurnBoundaryIndex + 1),
    );
}
