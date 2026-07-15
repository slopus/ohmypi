import type { SessionEvent } from "../protocol/index.js";

type SubmittedSteeringEvent = Extract<SessionEvent, { type: "message_submitted" }>;

export interface LegacyOrphanedSteering {
    events: readonly SubmittedSteeringEvent[];
    runId: string;
}

export function findLegacyOrphanedSteering(
    events: readonly SessionEvent[],
): readonly LegacyOrphanedSteering[] {
    const appliedSteering = new Set(
        events.flatMap((event) =>
            event.type === "steering_applied"
                ? event.data.messageIds.map((messageId) =>
                      JSON.stringify([event.data.runId, messageId]),
                  )
                : [],
        ),
    );
    const seenSubmittedSteering = new Set<string>();
    const pendingByRunId = new Map<string, SubmittedSteeringEvent[]>();
    const orphaned: LegacyOrphanedSteering[] = [];

    for (const event of events) {
        if (event.type === "message_submitted" && event.data.delivery === "steer") {
            const messageId = event.data.message.id;
            const steeringId = JSON.stringify([event.data.runId, messageId]);
            if (appliedSteering.has(steeringId) || seenSubmittedSteering.has(steeringId)) continue;
            seenSubmittedSteering.add(steeringId);
            const pending = pendingByRunId.get(event.data.runId) ?? [];
            pending.push(event);
            pendingByRunId.set(event.data.runId, pending);
            continue;
        }

        if (event.type !== "run_finished" && event.type !== "run_error") continue;
        const pending = pendingByRunId.get(event.data.runId);
        if (pending === undefined || pending.length === 0) continue;
        orphaned.push({ events: pending, runId: event.data.runId });
        pendingByRunId.delete(event.data.runId);
    }

    return orphaned;
}
