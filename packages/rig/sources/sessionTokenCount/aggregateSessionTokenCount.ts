import type { SessionEvent, SessionTokenCount } from "../protocol/index.js";
import { sessionTokenCountAfterEvent } from "./sessionTokenCountAfterEvent.js";

export function aggregateSessionTokenCount(events: readonly SessionEvent[]): SessionTokenCount {
    let count: SessionTokenCount | undefined;

    for (const event of events) {
        count = sessionTokenCountAfterEvent(count, event);
    }

    return count ?? { lastContextTokens: 0, totalTokens: 0 };
}
