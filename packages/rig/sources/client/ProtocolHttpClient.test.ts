import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it, vi } from "vitest";

import type { GlobalEventQueueEntry, SessionEvent } from "../protocol/index.js";
import { ProtocolHttpClient } from "./ProtocolHttpClient.js";

describe("ProtocolHttpClient", () => {
    it("rejects a transcript limit on event catch-up", async () => {
        const client = new ProtocolHttpClient({
            socketPath: "/tmp/rig-client-no-request.sock",
            token: "test-token",
        });

        await expect(
            client.getEvents("session-1", "event-1" as SessionEvent["id"], {
                messageLimit: 30,
            }),
        ).rejects.toThrow("only supported while loading initial history");
    });

    it("targets abort requests to the expected run", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        let requestedUrl: URL | undefined;
        const server = createServer((request, response) => {
            requestedUrl = new URL(request.url ?? "/", "http://unix");
            response.writeHead(200, { "content-type": "application/json" });
            response.end('{"aborted":false}');
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });

            await expect(
                client.abort("session-1", {
                    continuePendingSteering: true,
                    expectedRunId: "run/replaced 1",
                    steeringMessageIds: ["steer/one", "steer two"],
                }),
            ).resolves.toEqual({ aborted: false });
            expect(requestedUrl?.pathname).toBe("/sessions/session-1/abort");
            expect(requestedUrl?.searchParams.get("continuePendingSteering")).toBe("1");
            expect(requestedUrl?.searchParams.get("expectedRunId")).toBe("run/replaced 1");
            expect(requestedUrl?.searchParams.getAll("steeringMessageId")).toEqual([
                "steer/one",
                "steer two",
            ]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("surfaces a rejected session cursor without retrying forever", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        let streamRequests = 0;
        const server = createServer((_request, response) => {
            streamRequests += 1;
            response.writeHead(409, { "content-type": "application/json" });
            response.end('{"error":"Event cursor not found"}');
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });

            await expect(
                client.watchSessionEvents({
                    after: "018bcfe5-6800-7001-8000-000000000001",
                    sessionId: "session-1",
                    onEvent() {},
                }),
            ).rejects.toThrow("409");
            expect(streamRequests).toBe(1);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("reconnects SSE streams from the last received event id", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const first = sessionResetEvent("018bcfe5-6800-7001-8000-000000000001");
        const second = sessionResetEvent("018bcfe5-6800-7002-8000-000000000002");
        const requestedAfterValues: Array<string | null> = [];
        let streamRequests = 0;
        const server = createServer((request, response) => {
            expect(request.headers.authorization).toBe("Bearer test-token");
            const url = new URL(request.url ?? "/", "http://unix");
            requestedAfterValues.push(url.searchParams.get("after"));
            streamRequests += 1;
            response.writeHead(200, {
                "content-type": "text/event-stream; charset=utf-8",
            });
            if (streamRequests === 1) {
                writeSseEvent(response, first);
                response.end();
                return;
            }

            writeSseEvent(response, second);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const received: SessionEvent[] = [];

            await client.watchSessionEvents({
                sessionId: "session-1",
                signal: controller.signal,
                onEvent(event) {
                    received.push(event);
                    if (received.length === 2) {
                        controller.abort();
                    }
                },
            });

            expect(received.map((event) => event.id)).toEqual([first.id, second.id]);
            expect(requestedAfterValues).toEqual([null, first.id]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("keeps the last observed event cursor when an SSE transport fails", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const first = sessionResetEvent("018bcfe5-6800-7001-8000-000000000001");
        const second = sessionResetEvent("018bcfe5-6800-7002-8000-000000000002");
        const requestedAfterValues: Array<string | null> = [];
        let streamRequests = 0;
        const server = createServer((request, response) => {
            const url = new URL(request.url ?? "/", "http://unix");
            requestedAfterValues.push(url.searchParams.get("after"));
            streamRequests += 1;
            response.writeHead(200, {
                "content-type": "text/event-stream; charset=utf-8",
            });
            if (streamRequests === 1) {
                writeSseEvent(response, first);
                setImmediate(() => response.destroy(new Error("simulated stream failure")));
                return;
            }
            writeSseEvent(response, second);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const received: SessionEvent[] = [];

            await client.watchSessionEvents({
                sessionId: "session-1",
                signal: controller.signal,
                onEvent(event) {
                    received.push(event);
                    if (received.length === 2) controller.abort();
                },
            });

            expect(received.map((event) => event.id)).toEqual([first.id, second.id]);
            expect(requestedAfterValues).toEqual([null, first.id]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("serializes async event application and reconnects after the last successful apply", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const prior = sessionResetEvent("018bcfe5-6800-7001-8000-000000000001");
        const first = sessionResetEvent("018bcfe5-6800-7002-8000-000000000002");
        const second = sessionResetEvent("018bcfe5-6800-7003-8000-000000000003");
        const requestedAfterValues: Array<string | null> = [];
        let streamRequests = 0;
        const server = createServer((request, response) => {
            const url = new URL(request.url ?? "/", "http://unix");
            requestedAfterValues.push(url.searchParams.get("after"));
            streamRequests += 1;
            response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
            if (streamRequests === 1) {
                writeSseEvent(response, prior);
                writeSseEvent(response, first);
                writeSseEvent(response, second);
                return;
            }
            writeSseEvent(response, first);
            writeSseEvent(response, second);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const firstGate = deferred<void>();
            const applied: string[] = [];
            const attempted: string[] = [];
            let failFirstOnce = true;

            const watching = client.watchSessionEvents({
                sessionId: "session-1",
                signal: controller.signal,
                async onEvent(event) {
                    attempted.push(event.id);
                    if (event.id === first.id && failFirstOnce) {
                        await firstGate.promise;
                        failFirstOnce = false;
                        throw new Error("simulated apply failure");
                    }
                    applied.push(event.id);
                    if (event.id === second.id) controller.abort();
                },
            });

            await vi.waitFor(() => expect(streamRequests).toBe(1));
            await vi.waitFor(() => expect(attempted).toEqual([prior.id, first.id]));
            expect(applied).toEqual([prior.id]);
            firstGate.resolve(undefined);
            await watching;

            expect(attempted).toEqual([prior.id, first.id, first.id, second.id]);
            expect(applied).toEqual([prior.id, first.id, second.id]);
            expect(requestedAfterValues).toEqual([null, prior.id]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("waits for the current event application before an abort completes the stream", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const event = sessionResetEvent("018bcfe5-6800-7001-8000-000000000001");
        const server = createServer((_request, response) => {
            response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
            writeSseEvent(response, event);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const applicationStarted = deferred<void>();
            const releaseApplication = deferred<void>();
            const applied: string[] = [];
            let watchingCompleted = false;

            const watching = client.watchSessionEvents({
                sessionId: "session-1",
                signal: controller.signal,
                async onEvent(received) {
                    applicationStarted.resolve(undefined);
                    controller.abort();
                    await releaseApplication.promise;
                    applied.push(received.id);
                },
            });
            void watching.then(() => {
                watchingCompleted = true;
            });

            await applicationStarted.promise;
            await Promise.resolve();
            expect(watchingCompleted).toBe(false);
            expect(applied).toEqual([]);

            releaseApplication.resolve(undefined);
            await watching;
            expect(watchingCompleted).toBe(true);
            expect(applied).toEqual([event.id]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("serializes async global event application and reconnects after the last successful apply", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const prior = globalEvent(1);
        const first = globalEvent(2);
        const second = globalEvent(3);
        const requestedAfterValues: Array<string | null> = [];
        let streamRequests = 0;
        const server = createServer((request, response) => {
            const url = new URL(request.url ?? "/", "http://unix");
            requestedAfterValues.push(url.searchParams.get("after"));
            streamRequests += 1;
            response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
            if (streamRequests === 1) {
                writeGlobalSseEvent(response, prior);
                writeGlobalSseEvent(response, first);
                writeGlobalSseEvent(response, second);
                return;
            }
            writeGlobalSseEvent(response, first);
            writeGlobalSseEvent(response, second);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const firstGate = deferred<void>();
            const applied: number[] = [];
            const attempted: number[] = [];
            let failFirstOnce = true;

            const watching = client.watchGlobalEvents({
                signal: controller.signal,
                async onEvent(entry) {
                    attempted.push(entry.cursor);
                    if (entry.cursor === first.cursor && failFirstOnce) {
                        await firstGate.promise;
                        failFirstOnce = false;
                        throw new Error("simulated apply failure");
                    }
                    applied.push(entry.cursor);
                    if (entry.cursor === second.cursor) controller.abort();
                },
            });

            await vi.waitFor(() => expect(streamRequests).toBe(1));
            await vi.waitFor(() => expect(attempted).toEqual([prior.cursor, first.cursor]));
            expect(applied).toEqual([prior.cursor]);
            firstGate.resolve(undefined);
            await watching;

            expect(attempted).toEqual([prior.cursor, first.cursor, first.cursor, second.cursor]);
            expect(applied).toEqual([prior.cursor, first.cursor, second.cursor]);
            expect(requestedAfterValues).toEqual([null, String(prior.cursor)]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("waits for the current global event application before an abort completes the stream", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-client-test-"));
        const socketPath = join(directory, "server.sock");
        const entry = globalEvent(1);
        const server = createServer((_request, response) => {
            response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
            writeGlobalSseEvent(response, entry);
        });

        try {
            await new Promise<void>((resolve) => server.listen(socketPath, resolve));
            const client = new ProtocolHttpClient({ socketPath, token: "test-token" });
            const controller = new AbortController();
            const applicationStarted = deferred<void>();
            const releaseApplication = deferred<void>();
            const applied: number[] = [];
            let watchingCompleted = false;

            const watching = client.watchGlobalEvents({
                signal: controller.signal,
                async onEvent(received) {
                    applicationStarted.resolve(undefined);
                    controller.abort();
                    await releaseApplication.promise;
                    applied.push(received.cursor);
                },
            });
            void watching.then(() => {
                watchingCompleted = true;
            });

            await applicationStarted.promise;
            await Promise.resolve();
            expect(watchingCompleted).toBe(false);
            expect(applied).toEqual([]);

            releaseApplication.resolve(undefined);
            await watching;
            expect(watchingCompleted).toBe(true);
            expect(applied).toEqual([entry.cursor]);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await rm(directory, { recursive: true, force: true });
        }
    });
});

function sessionResetEvent(id: string): SessionEvent {
    return {
        createdAt: 1_700_000_000_000,
        data: {
            snapshot: {
                id: "agent-1",
                messages: [],
                modelId: "openai/gpt-5.5",
                providerId: "codex",
                queue: [],
                status: "idle",
                tools: [],
            },
        },
        id,
        sessionId: "session-1",
        type: "session_reset",
    };
}

function writeSseEvent(response: { write(data: string): void }, event: SessionEvent): void {
    response.write(`id: ${event.id}\n`);
    response.write(`event: ${event.type}\n`);
    response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function globalEvent(cursor: number): GlobalEventQueueEntry {
    return {
        cursor,
        event: sessionResetEvent(`018bcfe5-6800-700${cursor}-8000-00000000000${cursor}`),
    };
}

function writeGlobalSseEvent(
    response: { write(data: string): void },
    entry: GlobalEventQueueEntry,
): void {
    response.write(`id: ${entry.cursor}\n`);
    response.write(`event: ${entry.event.type}\n`);
    response.write(`data: ${JSON.stringify(entry.event)}\n\n`);
}

function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
} {
    let resolve = (_value: T | PromiseLike<T>): void => undefined;
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve;
    });
    return { promise, resolve };
}
