import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "../../packages/gym/sources/index.js";

const running = new Set<Gym>();
const LEGACY_MESSAGE_ID = "xkcgqjy6uhadhr5eq4oy02tj";
const LEGACY_MESSAGE = "so for all of these i want that";
const RESUME_MARKER = "LEGACY_STEERING_REPAIRED_RESUME";

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("legacy orphaned steering after resume", () => {
    it("repairs the original message once and Escape stops the continued inference", async () => {
        const gym = await createGym({
            cols: 96,
            entrypoint: [
                "bash",
                "-lc",
                [
                    "node /app/packages/rig/dist/main.js",
                    "node /app/packages/rig/dist/main.js daemon stop",
                    "node /workspace/seed-legacy-orphaned-steering.mjs",
                    "node /app/packages/rig/dist/main.js daemon start",
                    `echo ${RESUME_MARKER}`,
                    "exec node /app/packages/rig/dist/main.js resume --last",
                ].join("; "),
            ],
            files: {
                "seed-legacy-orphaned-steering.mjs": seedLegacyOrphanedSteeringScript,
            },
            inference(request, callIndex) {
                if (callIndex === 0) {
                    return { content: [{ text: "LEGACY_SEED_SESSION_READY", type: "text" }] };
                }

                expect(callIndex).toBe(1);
                const userTexts = request.context.messages.flatMap((message) =>
                    message.role === "user" ? [messageText(message.content)] : [],
                );
                expect(userTexts.filter((text) => text === LEGACY_MESSAGE)).toHaveLength(1);
                expect(userTexts).toContain("Continue after repairing the legacy direction.");
                return {
                    content: [{ text: "UNREACHABLE_CONTINUED_RESPONSE", type: "text" }],
                    delayMs: 60_000,
                };
            },
            rows: 60,
        });
        running.add(gym);

        submit(gym, "Create the session that will receive a legacy event sequence.");
        await gym.terminal.waitForText("LEGACY_SEED_SESSION_READY", 30_000);
        gym.terminal.press("ctrlD");

        const resumed = await gym.terminal.waitUntil(
            (snapshot) => {
                const marker = snapshot.text.indexOf(RESUME_MARKER);
                if (marker < 0) return false;
                const resumedText = snapshot.text.slice(marker);
                return (
                    resumedText.includes(LEGACY_MESSAGE) &&
                    resumedText.includes("Ask Rig to do anything") &&
                    !resumedText.includes("Messages to be submitted after next tool call")
                );
            },
            "the repaired legacy message to resume without pending steering",
            30_000,
        );
        const resumedText = resumed.text.slice(resumed.text.indexOf(RESUME_MARKER));
        expect(countOccurrences(resumedText, LEGACY_MESSAGE)).toBe(1);
        await screenshot(gym, "legacy-orphan-repaired-resume.png");

        const repaired = await readLegacyRepairState(gym);
        expect(repaired.appliedCount).toBe(1);
        expect(repaired.appliedMessageIds).toEqual([LEGACY_MESSAGE_ID]);
        expect(repaired.contextCount).toBe(1);
        expect(repaired.storedCount).toBe(1);
        expect(repaired.storedMessageIds).toEqual([LEGACY_MESSAGE_ID]);
        expect(repaired.submittedCount).toBe(1);
        expect(repaired.submittedRunId).toBe(repaired.finishedRunId);
        expect(repaired.appliedRunId).toBe(repaired.finishedRunId);
        expect(repaired.submittedSeq).toBeLessThan(repaired.finishedSeq);
        expect(repaired.finishedSeq).toBeLessThan(repaired.appliedSeq);

        submit(gym, "Continue after repairing the legacy direction.");
        await gym.terminal.waitUntil(
            (snapshot) =>
                agentRequests(gym).length === 2 &&
                snapshot.text.includes("esc to interrupt") &&
                !snapshot.text.includes("Messages to be submitted after next tool call"),
            "the next inference to contain the repaired message exactly once",
            30_000,
        );

        gym.terminal.press("escape");
        const stopped = await gym.terminal.waitUntil(
            (snapshot) =>
                snapshot.text.includes("Session interrupted") &&
                snapshot.text.includes("Ask Rig to do anything") &&
                !snapshot.text.includes("esc to interrupt") &&
                !snapshot.text.includes("Messages to be submitted after next tool call"),
            "Escape to stop rather than attempt an empty pending continuation",
            30_000,
        );
        expect(agentRequests(gym)).toHaveLength(2);
        expect(countOccurrences(stopped.text, LEGACY_MESSAGE)).toBe(1);
        expect(await readLegacyRepairState(gym)).toEqual(repaired);
        await screenshot(gym, "legacy-orphan-escape-stopped.png");
    }, 120_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}

function agentRequests(gym: Gym) {
    return gym.inference.requests.filter(
        (request) => !request.options.sessionId?.endsWith(":title"),
    );
}

function messageText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .filter(
            (block): block is { text: string } =>
                typeof block === "object" &&
                block !== null &&
                "text" in block &&
                typeof block.text === "string",
        )
        .map((block) => block.text)
        .join("\n");
}

function countOccurrences(text: string, value: string): number {
    return text.split(value).length - 1;
}

async function readLegacyRepairState(gym: Gym): Promise<{
    appliedCount: number;
    appliedMessageIds: string[];
    appliedRunId: string;
    appliedSeq: number;
    contextCount: number;
    finishedRunId: string;
    finishedSeq: number;
    storedCount: number;
    storedMessageIds: string[];
    submittedCount: number;
    submittedRunId: string;
    submittedSeq: number;
}> {
    const result = await gym.runInContainer("node", ["-e", inspectLegacyRepairScript]);
    expect(result.stderr).toBe("");
    return JSON.parse(result.stdout) as {
        appliedCount: number;
        appliedMessageIds: string[];
        appliedRunId: string;
        appliedSeq: number;
        contextCount: number;
        finishedRunId: string;
        finishedSeq: number;
        storedCount: number;
        storedMessageIds: string[];
        submittedCount: number;
        submittedRunId: string;
        submittedSeq: number;
    };
}

async function screenshot(gym: Gym, name: string): Promise<void> {
    const directory = process.env.RIG_GYM_SCREENSHOT_DIR;
    if (directory === undefined) return;
    await gym.terminal.screenshot(resolve(directory, name));
}

const seedLegacyOrphanedSteeringScript = `
import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync("/home/rig/.local/state/rig/sessions.sqlite");
const session = database
    .prepare("SELECT id FROM sessions WHERE parent_session_id IS NULL ORDER BY created_at_ms DESC LIMIT 1")
    .get();
if (session === undefined) throw new Error("Expected a session to seed.");
const runId = "legacy-orphaned-steering-run";
const createdAt = Date.now();
const insert = database.prepare(
    "INSERT INTO session_events (session_id, event_id, type, created_at_ms, data_json) VALUES (?, ?, ?, ?, ?)",
);
insert.run(session.id, "legacy-run-started", "run_started", createdAt, JSON.stringify({ runId }));
insert.run(
    session.id,
    "legacy-steer-submitted",
    "message_submitted",
    createdAt + 1,
    JSON.stringify({
        delivery: "steer",
        displayText: ${JSON.stringify(LEGACY_MESSAGE)},
        message: {
            blocks: [{ text: ${JSON.stringify(LEGACY_MESSAGE)}, type: "text" }],
            id: ${JSON.stringify(LEGACY_MESSAGE_ID)},
            role: "user",
        },
        runId,
    }),
);
insert.run(
    session.id,
    "legacy-run-finished",
    "run_finished",
    createdAt + 2,
    JSON.stringify({
        agentRunId: "legacy-agent-run",
        modelLocked: true,
        runId,
        stopReason: "aborted",
    }),
);
database
    .prepare("UPDATE sessions SET status = 'aborted', active_run_id = NULL WHERE id = ?")
    .run(session.id);
database.close();
`;

const inspectLegacyRepairScript = `
const { DatabaseSync } = require("node:sqlite");
const database = new DatabaseSync("/home/rig/.local/state/rig/sessions.sqlite");
const session = database
    .prepare("SELECT id FROM sessions WHERE parent_session_id IS NULL ORDER BY created_at_ms DESC LIMIT 1")
    .get();
const events = database
    .prepare("SELECT seq, type, data_json FROM session_events WHERE session_id = ? ORDER BY seq")
    .all(session.id)
    .map((event) => ({ ...event, data: JSON.parse(event.data_json) }));
const submitted = events.filter(
    (event) =>
        event.type === "message_submitted" &&
        event.data.delivery === "steer" &&
        event.data.message.id === ${JSON.stringify(LEGACY_MESSAGE_ID)},
);
const applied = events.filter(
    (event) =>
        event.type === "steering_applied" &&
        event.data.messageIds.includes(${JSON.stringify(LEGACY_MESSAGE_ID)}),
);
const finished = events.filter(
    (event) =>
        event.type === "run_finished" &&
        event.data.runId === submitted[0]?.data.runId,
);
const stored = database
    .prepare("SELECT message_id FROM session_messages WHERE session_id = ? AND message_id = ? ORDER BY position")
    .all(session.id, ${JSON.stringify(LEGACY_MESSAGE_ID)});
const sessionRow = database
    .prepare("SELECT context_messages_json FROM sessions WHERE id = ?")
    .get(session.id);
const contextMessages = sessionRow.context_messages_json === null
    ? []
    : JSON.parse(sessionRow.context_messages_json);
database.close();
process.stdout.write(JSON.stringify({
    appliedCount: applied.length,
    appliedMessageIds: applied.flatMap((event) => event.data.messageIds),
    appliedRunId: applied[0]?.data.runId,
    appliedSeq: applied[0]?.seq,
    contextCount: contextMessages.filter((message) => message.id === ${JSON.stringify(LEGACY_MESSAGE_ID)}).length,
    finishedRunId: finished[0]?.data.runId,
    finishedSeq: finished[0]?.seq,
    storedCount: stored.length,
    storedMessageIds: stored.map((message) => message.message_id),
    submittedCount: submitted.length,
    submittedRunId: submitted[0]?.data.runId,
    submittedSeq: submitted[0]?.seq,
}));
`;
