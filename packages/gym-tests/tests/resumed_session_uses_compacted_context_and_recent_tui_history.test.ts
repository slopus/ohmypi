import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("a resumed compacted session", () => {
    it("sends only compacted context and loads its latest 30 transcript messages into the TUI", async () => {
        const gym = await createGym({
            cols: 100,
            entrypoint: ["bash", "/workspace/resume-session.sh"],
            files: {
                "create-session.mjs": createSessionScript,
                "resume-session.sh": {
                    content: resumeSessionScript,
                    mode: 0o755,
                },
            },
            inference(request) {
                const serializedContext = JSON.stringify(request.context.messages);
                expect(request.context.messages).toHaveLength(2);
                expect(serializedContext).toContain("Earlier work was compacted.");
                expect(serializedContext).toContain("Continue from the compacted session.");
                expect(serializedContext).not.toContain("history-31");
                return { content: [{ text: "RESUMED_COMPACTED_CONTEXT_OK", type: "text" }] };
            },
            mode: "docker",
            rows: 36,
            timeoutMs: 60_000,
        });
        running.add(gym);

        await gym.terminal.waitForText("history-31", 30_000);
        gym.terminal.scrollToTop();
        const earliest = await gym.terminal.waitUntil(
            (snapshot) => snapshot.text.includes("history-2"),
            "the earliest retained transcript message",
            30_000,
        );
        expect(earliest.text).not.toContain("history-1");
        expect(earliest.text).not.toContain("history-0");

        gym.terminal.scrollToBottom();
        gym.terminal.type("Continue from the compacted session.");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("RESUMED_COMPACTED_CONTEXT_OK", 30_000);
    }, 90_000);
});

const resumeSessionScript = String.raw`#!/usr/bin/env bash
set -euo pipefail

node /workspace/create-session.mjs
exec node /app/packages/rig/dist/main.js resume "$(cat /workspace/session-id)"
`;

const createSessionScript = String.raw`
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { createEventIdFactory } from "/app/packages/rig/dist/protocol/index.js";
import { PersistentSessionStore } from "/app/packages/rig/dist/server/index.js";

const databasePath = "/home/rig/.rig/sessions.sqlite";
const createdAt = Date.now() - 60_000;
const store = new PersistentSessionStore({ databasePath, now: () => createdAt });
const session = store.create({
    cwd: "/workspace",
    modelId: "openai/gym",
    permissionMode: "full_access",
    providerId: "gym",
});
store.close();

const database = new DatabaseSync(databasePath);
const sessionRow = database
    .prepare("SELECT last_event_id FROM sessions WHERE id = ?")
    .get(session.id);
const createEventId = createEventIdFactory({
    after: sessionRow.last_event_id,
    now: () => createdAt + 1,
});
const insertEvent = database.prepare(
    "INSERT INTO session_events (session_id, event_id, type, created_at_ms, data_json) VALUES (?, ?, ?, ?, ?)",
);
const insertMessage = database.prepare(
    "INSERT INTO session_messages (session_id, position, message_id, role, is_partial, run_id, message_json, updated_at_ms) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
);

let lastEventId = sessionRow.last_event_id;
database.exec("BEGIN IMMEDIATE");
try {
    for (let index = 0; index < 32; index += 1) {
        const text = "history-" + String(index);
        const message = {
            blocks: [{ text, type: "text" }],
            id: "message-" + String(index),
            role: "user",
        };
        insertMessage.run(
            session.id,
            index,
            message.id,
            message.role,
            "run-" + String(index),
            JSON.stringify(message),
            createdAt + index,
        );
        lastEventId = createEventId();
        insertEvent.run(
            session.id,
            lastEventId,
            "message_submitted",
            createdAt + index,
            JSON.stringify({
                delivery: "run",
                displayText: text,
                message,
                runId: "run-" + String(index),
            }),
        );
    }
    database
        .prepare(
            "UPDATE sessions SET context_messages_json = ?, last_event_id = ?, status = 'completed', updated_at_ms = ? WHERE id = ?",
        )
        .run(
            JSON.stringify([
                {
                    blocks: [{ text: "<conversation_summary>Earlier work was compacted.</conversation_summary>", type: "text" }],
                    id: "summary-1",
                    role: "user",
                },
            ]),
            lastEventId,
            createdAt + 32,
            session.id,
        );
    database.exec("COMMIT");
} catch (error) {
    database.exec("ROLLBACK");
    throw error;
}
database.close();
writeFileSync("/workspace/session-id", session.id);
`;
