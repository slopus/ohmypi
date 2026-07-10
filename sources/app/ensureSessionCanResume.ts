import type { ProtocolSession } from "../protocol/index.js";

export function ensureSessionCanResume(session: ProtocolSession): void {
    if (session.agent.type === "subagent") {
        throw new Error(
            "Subagent histories are read-only and can only be viewed from their parent session.",
        );
    }
}
