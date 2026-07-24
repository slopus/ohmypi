import type { SessionSummary } from "../protocol/index.js";
import type { SessionTerminalTracker } from "./SessionTerminalTracker.js";

export function sessionSummaryWithTerminalPresence(
    summary: SessionSummary,
    terminals: SessionTerminalTracker,
): SessionSummary {
    const presentedSummary =
        summary.unread !== undefined && terminals.hasFocusedTerminal(summary.id)
            ? withoutUnread(summary)
            : summary;
    if (
        terminals.hasConnectedTerminal(summary.id) ||
        summary.status === "queued" ||
        summary.status === "running"
    ) {
        return presentedSummary;
    }
    return {
        ...presentedSummary,
        status: summary.archiveOnIdle ? "archived" : "idle",
    };
}

function withoutUnread(summary: SessionSummary): SessionSummary {
    const { unread: _, ...readSummary } = summary;
    return readSummary;
}
