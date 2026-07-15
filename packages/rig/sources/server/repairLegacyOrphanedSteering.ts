import type { DatabaseSync } from "node:sqlite";

import type { Message } from "../agent/types.js";
import type { EventId, GlobalEventQueueEntry, SessionEvent } from "../protocol/index.js";
import { findLegacyOrphanedSteering } from "./findLegacyOrphanedSteering.js";
import type { PersistentGlobalEventQueue } from "./PersistentGlobalEventQueue.js";

export function repairLegacyOrphanedSteering(
    database: DatabaseSync,
    options: {
        createEventId: () => EventId;
        globalEventQueue?: PersistentGlobalEventQueue;
        now: () => number;
    },
): void {
    const globalEntries: GlobalEventQueueEntry[] = [];
    database.exec("BEGIN IMMEDIATE");
    try {
        const sessions = database
            .prepare(
                "SELECT id, context_messages_json, interruption_json FROM sessions ORDER BY created_at_ms ASC",
            )
            .all();
        for (const session of sessions) {
            const sessionId = readString(session, "id");
            const interruptionJson = readOptionalString(session, "interruption_json");
            const interruption =
                interruptionJson === undefined
                    ? undefined
                    : (JSON.parse(interruptionJson) as {
                          message?: unknown;
                          runId?: unknown;
                      });
            const events = loadEvents(database, sessionId).filter(
                (event) =>
                    event.type !== "run_error" ||
                    event.data.runId !== interruption?.runId ||
                    event.data.errorMessage !== interruption.message,
            );
            const orphaned = findLegacyOrphanedSteering(events);
            if (orphaned.length === 0) continue;

            const storedRows = database
                .prepare(
                    "SELECT position, message_id FROM session_messages WHERE session_id = ? ORDER BY position",
                )
                .all(sessionId);
            const storedMessageIds = new Set(
                storedRows.map((row) => readString(row, "message_id")),
            );
            let nextPosition =
                storedRows.reduce(
                    (highest, row) => Math.max(highest, readNumber(row, "position")),
                    -1,
                ) + 1;
            const contextJson = readOptionalString(session, "context_messages_json");
            const contextMessages =
                contextJson === undefined ? undefined : (JSON.parse(contextJson) as Message[]);
            const contextMessageIds = new Set(contextMessages?.map((message) => message.id) ?? []);
            let contextChanged = false;
            let lastEventId: string | undefined;

            for (const group of orphaned) {
                for (const submitted of group.events) {
                    const message = submitted.data.message;
                    if (!storedMessageIds.has(message.id)) {
                        database
                            .prepare(
                                `
                                INSERT INTO session_messages (
                                    session_id,
                                    position,
                                    message_id,
                                    role,
                                    is_partial,
                                    run_id,
                                    message_json,
                                    updated_at_ms
                                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)
                                `,
                            )
                            .run(
                                sessionId,
                                nextPosition,
                                message.id,
                                message.role,
                                group.runId,
                                JSON.stringify(message),
                                options.now(),
                            );
                        nextPosition += 1;
                        storedMessageIds.add(message.id);
                    }
                    if (contextMessages !== undefined && !contextMessageIds.has(message.id)) {
                        contextMessages.push(message);
                        contextMessageIds.add(message.id);
                        contextChanged = true;
                    }
                }

                const event: Extract<SessionEvent, { type: "steering_applied" }> = {
                    createdAt: options.now(),
                    data: {
                        messageIds: group.events.map((event) => event.data.message.id),
                        runId: group.runId,
                    },
                    id: options.createEventId(),
                    sessionId,
                    type: "steering_applied",
                };
                database
                    .prepare(
                        `
                        INSERT INTO session_events (
                            session_id,
                            event_id,
                            type,
                            created_at_ms,
                            data_json
                        ) VALUES (?, ?, ?, ?, ?)
                        `,
                    )
                    .run(
                        event.sessionId,
                        event.id,
                        event.type,
                        event.createdAt,
                        JSON.stringify(event.data),
                    );
                const globalEntry = options.globalEventQueue?.persist(event);
                if (globalEntry !== undefined) globalEntries.push(globalEntry);
                lastEventId = event.id;
            }

            if (contextChanged) {
                database
                    .prepare("UPDATE sessions SET context_messages_json = ? WHERE id = ?")
                    .run(JSON.stringify(contextMessages), sessionId);
            }
            if (lastEventId !== undefined) {
                database
                    .prepare(
                        "UPDATE sessions SET last_event_id = ?, updated_at_ms = ? WHERE id = ?",
                    )
                    .run(lastEventId, options.now(), sessionId);
            }
        }
        database.exec("COMMIT");
    } catch (error) {
        database.exec("ROLLBACK");
        throw error;
    }

    for (const entry of globalEntries) options.globalEventQueue?.publish(entry);
}

function loadEvents(database: DatabaseSync, sessionId: string): SessionEvent[] {
    return database
        .prepare(
            `
            SELECT event_id, type, created_at_ms, data_json
            FROM session_events
            WHERE session_id = ?
            ORDER BY seq ASC
            `,
        )
        .all(sessionId)
        .map((row) => ({
            createdAt: readNumber(row, "created_at_ms"),
            data: JSON.parse(readString(row, "data_json")) as SessionEvent["data"],
            id: readString(row, "event_id"),
            sessionId,
            type: readString(row, "type") as SessionEvent["type"],
        })) as SessionEvent[];
}

function readNumber(row: Record<string, unknown>, key: string): number {
    const value = row[key];
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    throw new Error(`Expected numeric SQLite column '${key}'.`);
}

function readOptionalString(row: Record<string, unknown>, key: string): string | undefined {
    const value = row[key];
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string") return value;
    throw new Error(`Expected text SQLite column '${key}'.`);
}

function readString(row: Record<string, unknown>, key: string): string {
    const value = readOptionalString(row, key);
    if (value !== undefined) return value;
    throw new Error(`Expected text SQLite column '${key}'.`);
}
