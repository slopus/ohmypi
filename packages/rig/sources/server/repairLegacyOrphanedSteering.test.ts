import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { EventId } from "../protocol/index.js";
import type { PersistedSessionState } from "./InMemorySession.js";
import { PersistentGlobalEventQueue } from "./PersistentGlobalEventQueue.js";
import { PersistentSessionStore } from "./PersistentSessionStore.js";
import { repairLegacyOrphanedSteering } from "./repairLegacyOrphanedSteering.js";

describe("repairLegacyOrphanedSteering", () => {
    it("rolls back message, context, event, last-event, and global cursor together", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-legacy-steering-atomicity-"));
        const databasePath = join(directory, "sessions.sqlite");
        try {
            const store = new PersistentSessionStore({
                databasePath,
                durableGlobalEventQueue: true,
            });
            store.saveSession(sessionState());
            store.close();

            const database = new DatabaseSync(databasePath);
            const insert = database.prepare(
                "INSERT INTO session_events (session_id, event_id, type, created_at_ms, data_json) VALUES (?, ?, ?, ?, ?)",
            );
            insert.run(
                "session-1",
                "started",
                "run_started",
                1,
                JSON.stringify({ runId: "run-1" }),
            );
            insert.run(
                "session-1",
                "submitted",
                "message_submitted",
                2,
                JSON.stringify({
                    delivery: "steer",
                    displayText: "repair atomically",
                    message: {
                        blocks: [{ text: "repair atomically", type: "text" }],
                        id: "legacy-message",
                        role: "user",
                    },
                    runId: "run-1",
                }),
            );
            insert.run(
                "session-1",
                "finished",
                "run_finished",
                3,
                JSON.stringify({
                    agentRunId: "agent-run-1",
                    modelLocked: true,
                    runId: "run-1",
                    stopReason: "aborted",
                }),
            );
            insert.run(
                "session-1",
                "duplicate-event-id",
                "permission_mode_changed",
                4,
                JSON.stringify({ permissionMode: "workspace_write" }),
            );
            const queue = new PersistentGlobalEventQueue(database);

            expect(() =>
                repairLegacyOrphanedSteering(database, {
                    createEventId: () => "duplicate-event-id" as EventId,
                    globalEventQueue: queue,
                    now: () => 100,
                }),
            ).toThrow();

            expect(
                database
                    .prepare("SELECT COUNT(*) AS count FROM session_messages WHERE session_id = ?")
                    .get("session-1"),
            ).toEqual({ count: 0 });
            expect(
                database
                    .prepare(
                        "SELECT context_messages_json, last_event_id FROM sessions WHERE id = ?",
                    )
                    .get("session-1"),
            ).toEqual({ context_messages_json: "[]", last_event_id: null });
            expect(
                database.prepare("SELECT COUNT(*) AS count FROM durable_global_events").get(),
            ).toEqual({ count: 0 });
            expect(
                database
                    .prepare(
                        "SELECT last_cursor, trimmed_through FROM durable_global_event_queue_state WHERE id = 1",
                    )
                    .get(),
            ).toEqual({ last_cursor: 0, trimmed_through: 0 });
            database.close();
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });
});

function sessionState(): PersistedSessionState {
    return {
        agent: { depth: 0, rootSessionId: "session-1", type: "primary" },
        agentId: "agent-1",
        contextMessages: [],
        cwd: "/tmp/rig-legacy-steering-atomicity",
        id: "session-1",
        messages: [],
        modelId: "openai/gpt-5.5",
        models: [],
        nextTaskId: 1,
        permissionMode: "workspace_write",
        providerId: "codex",
        queuedRuns: [],
        status: "aborted",
        tasks: [],
        titleStatus: "idle",
        tools: [],
    };
}
