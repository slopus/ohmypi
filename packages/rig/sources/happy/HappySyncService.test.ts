import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelCatalog } from "../protocol/index.js";
import { PersistentSessionStore } from "../server/PersistentSessionStore.js";
import { createHappySpawnSessionId } from "./createHappySpawnSessionId.js";
import { decryptHappyPayload, encryptHappyPayload } from "./happyEncryption.js";
import { HappySyncService } from "./HappySyncService.js";
import type { HappyConnectionConfiguration } from "./types.js";

const directories: string[] = [];

afterEach(async () => {
    await Promise.all(
        directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
});

describe("HappySyncService machine spawning", () => {
    it("creates, synchronizes, and idempotently retries a persistent session through encrypted RPC", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-happy-service-"));
        directories.push(directory);
        const databasePath = join(directory, "sessions.sqlite");
        const workspace = join(directory, "workspace");
        await mkdir(workspace);
        const secret = new Uint8Array(32).fill(7);
        const modelCatalog = catalog();
        const configuration: HappyConnectionConfiguration = {
            credentials: {
                encryption: { secret, type: "legacy" },
                token: "happy-token",
            },
            credentialsPath: join(directory, "access.key"),
            happyHome: join(directory, "happy"),
            imported: false,
            machineId: "rig-machine-1",
            serverUrl: "https://happy.example",
        };
        const store = new PersistentSessionStore({ databasePath, modelCatalog });
        const sockets = new Map<string, FakeSocket>();
        const request = vi.fn<typeof fetch>(async (input, init) => {
            const url = new URL(String(input));
            if (url.pathname === "/v1/machines") {
                const body = JSON.parse(String(init?.body)) as { metadata: string };
                return Response.json({
                    machine: {
                        daemonStateVersion: 0,
                        metadata: body.metadata,
                        metadataVersion: 0,
                    },
                });
            }
            if (url.pathname === "/v1/sessions") {
                const body = JSON.parse(String(init?.body)) as { metadata: string };
                return Response.json({
                    session: {
                        id: "happy-session-1",
                        metadata: body.metadata,
                        metadataVersion: 0,
                    },
                });
            }
            if (url.pathname === "/v3/sessions/happy-session-1/messages") {
                return Response.json(
                    init?.method === "POST" ? {} : { hasMore: false, messages: [] },
                );
            }
            return new Response("Not found", { status: 404 });
        });
        const service = new HappySyncService({
            configuration,
            createSession: (id, sessionRequest) => store.createWithId(id, sessionRequest),
            databasePath,
            fetch: request,
            modelCatalog,
            socketFactory: (_url, options) => {
                const auth = options?.auth as { clientType?: unknown } | undefined;
                const clientType = String(auth?.clientType);
                const socket = new FakeSocket();
                sockets.set(clientType, socket);
                return socket;
            },
        });
        service.start();
        await waitFor(() => sockets.get("machine-scoped")?.connected === true);
        const machine = sockets.get("machine-scoped")!;
        const params = {
            agent: "rig",
            clientRequestId: "mobile-request-1",
            directory: workspace,
            type: "spawn-in-directory",
        };
        const encryptedParams = Buffer.from(encryptHappyPayload(secret, "legacy", params)).toString(
            "base64",
        );

        const first = await machine.requestRpc({
            method: "rig-machine-1:spawn-happy-session",
            params: encryptedParams,
        });
        const second = await machine.requestRpc({
            method: "rig-machine-1:spawn-happy-session",
            params: encryptedParams,
        });

        expect(decode(secret, first)).toEqual({ sessionId: "happy-session-1", type: "success" });
        expect(decode(secret, second)).toEqual({ sessionId: "happy-session-1", type: "success" });
        const localSessionId = createHappySpawnSessionId("rig-machine-1", "mobile-request-1");
        expect(store.get(localSessionId)?.snapshot()).toMatchObject({
            cwd: workspace,
            permissionMode: "auto",
        });
        expect(store.list()).toHaveLength(1);

        await service.close();
        const requestsAfterClose = request.mock.calls.length;
        service.attach(store.create({ cwd: workspace }));
        service.start();
        await Promise.resolve();
        expect(request).toHaveBeenCalledTimes(requestsAfterClose);
        store.close();
    });

    it("keeps session synchronization available when machine metadata cannot be built", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-happy-service-isolation-"));
        directories.push(directory);
        const databasePath = join(directory, "sessions.sqlite");
        const validCatalog = catalog();
        const store = new PersistentSessionStore({ databasePath, modelCatalog: validCatalog });
        const request = vi.fn<typeof fetch>(async (input, init) => {
            const url = new URL(String(input));
            if (url.pathname === "/v1/sessions") {
                const body = JSON.parse(String(init?.body)) as { metadata: string };
                return Response.json({
                    session: {
                        id: "happy-session-isolated",
                        metadata: body.metadata,
                        metadataVersion: 0,
                    },
                });
            }
            if (url.pathname === "/v3/sessions/happy-session-isolated/messages") {
                return Response.json(
                    init?.method === "POST" ? {} : { hasMore: false, messages: [] },
                );
            }
            return new Response("Not found", { status: 404 });
        });
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const service = new HappySyncService({
            configuration: {
                credentials: {
                    encryption: { secret: new Uint8Array(32).fill(3), type: "legacy" },
                    token: "happy-token",
                },
                credentialsPath: join(directory, "access.key"),
                happyHome: join(directory, "happy"),
                imported: false,
                machineId: "rig-machine-invalid-catalog",
                serverUrl: "https://happy.example",
            },
            createSession: (id, sessionRequest) => store.createWithId(id, sessionRequest),
            databasePath,
            fetch: request,
            modelCatalog: { ...validCatalog, defaultModelId: "missing-model" },
            socketFactory: () => new FakeSocket(),
        });
        try {
            service.attach(store.create({ cwd: directory }));
            await waitFor(() =>
                request.mock.calls.some(([input]) => String(input).endsWith("/v1/sessions")),
            );
            expect(log).toHaveBeenCalledWith(
                expect.stringContaining("machine sync is unavailable"),
            );
        } finally {
            await service.close();
            store.close();
            log.mockRestore();
        }
    });
});

class FakeSocket {
    connected = false;
    readonly #listeners = new Map<string, (...values: any[]) => void>();

    connect(): void {
        this.connected = true;
        this.#listeners.get("connect")?.();
    }

    disconnect(): void {
        this.connected = false;
    }

    emit(event: string, ...values: any[]): void {
        const callback = values.at(-1);
        if (typeof callback !== "function") return;
        if (event === "machine-update-metadata") {
            callback({ metadata: values[0].metadata, result: "success", version: 1 });
        } else if (event === "machine-update-state") {
            callback({ daemonState: values[0].daemonState, result: "success", version: 1 });
        } else if (event === "update-metadata") {
            callback({ result: "success", version: 1 });
        }
    }

    on(event: string, listener: (...values: any[]) => void): void {
        this.#listeners.set(event, listener);
    }

    requestRpc(request: unknown): Promise<string> {
        return new Promise((resolve) => this.#listeners.get("rpc-request")?.(request, resolve));
    }
}

function catalog(): ModelCatalog {
    const model = {
        defaultThinkingLevel: "high",
        id: "gpt-test",
        name: "GPT Test",
        thinkingLevels: ["low", "high"],
    } as const;
    return {
        defaultModelId: model.id,
        defaultProviderId: "codex",
        models: [model],
        providers: [{ models: [model], providerId: "codex" }],
    };
}

function decode(secret: Uint8Array, value: string): unknown {
    return decryptHappyPayload(secret, "legacy", Buffer.from(value, "base64"));
}

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("Timed out waiting for Happy synchronization.");
}
