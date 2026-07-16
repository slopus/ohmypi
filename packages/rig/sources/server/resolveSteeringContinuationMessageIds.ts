import type { SessionEvent } from "../protocol/index.js";

export function resolveSteeringContinuationMessageIds(options: {
    events: readonly SessionEvent[];
    pendingMessageIds: ReadonlySet<string>;
    requestedMessageIds: readonly string[] | undefined;
    runId: string;
}): readonly string[] | undefined {
    const submittedIds = options.events.flatMap((event) =>
        event.type === "message_submitted" &&
        event.data.delivery === "steer" &&
        event.data.runId === options.runId &&
        event.data.source !== "notification"
            ? [event.data.message.id]
            : [],
    );
    const submittedIdSet = new Set(submittedIds);
    const appliedIds = new Set(
        options.events.flatMap((event) =>
            event.type === "steering_applied" && event.data.runId === options.runId
                ? event.data.messageIds
                : [],
        ),
    );
    const requestedIds =
        options.requestedMessageIds ??
        submittedIds.filter((messageId) => options.pendingMessageIds.has(messageId));
    if (requestedIds.length === 0 || new Set(requestedIds).size !== requestedIds.length) {
        return undefined;
    }
    if (
        requestedIds.some(
            (messageId) =>
                !submittedIdSet.has(messageId) ||
                (!options.pendingMessageIds.has(messageId) && !appliedIds.has(messageId)),
        )
    ) {
        return undefined;
    }
    return requestedIds;
}
