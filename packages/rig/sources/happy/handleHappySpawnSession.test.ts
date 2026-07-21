import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelCatalog } from "../protocol/index.js";
import { handleHappySpawnSession } from "./handleHappySpawnSession.js";

const directories: string[] = [];
const catalog: ModelCatalog = {
    defaultModelId: "gpt-test",
    defaultProviderId: "codex",
    models: [],
    providers: [
        {
            models: [
                {
                    defaultThinkingLevel: "medium",
                    id: "gpt-test",
                    name: "GPT Test",
                    thinkingLevels: ["low", "medium", "high"],
                },
            ],
            providerId: "codex",
        },
    ],
};

afterEach(async () => {
    await Promise.all(
        directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
});

describe("handleHappySpawnSession", () => {
    it("creates one idempotent session with Rig's auto default and returns its Happy ID", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-happy-spawn-"));
        directories.push(directory);
        const createSession = vi.fn();
        const options = {
            createSession,
            machineId: "rig-machine",
            modelCatalog: catalog,
            params: {
                agent: "rig",
                clientRequestId: "mobile-request-1",
                directory,
                type: "spawn-in-directory",
            },
            waitForRemoteSession: vi.fn(async () => "happy-session-1"),
        } as const;

        await expect(handleHappySpawnSession(options)).resolves.toEqual({
            sessionId: "happy-session-1",
            type: "success",
        });
        await handleHappySpawnSession(options);

        expect(createSession.mock.calls[0]?.[0]).toMatch(/^happy-rig-/u);
        expect(createSession.mock.calls[1]?.[0]).toBe(createSession.mock.calls[0]?.[0]);
        expect(createSession.mock.calls[0]?.[1]).toMatchObject({
            cwd: directory,
            effort: "medium",
            modelId: "gpt-test",
            permissionMode: "auto",
            providerId: "codex",
        });
    });

    it("requires confirmation before creating a missing directory", async () => {
        const parent = await mkdtemp(join(tmpdir(), "rig-happy-spawn-missing-"));
        directories.push(parent);
        const directory = join(parent, "new-project");
        const createSession = vi.fn();

        await expect(
            handleHappySpawnSession({
                createSession,
                machineId: "rig-machine",
                modelCatalog: catalog,
                params: {
                    agent: "rig",
                    clientRequestId: "mobile-request-2",
                    directory,
                    type: "spawn-in-directory",
                },
                waitForRemoteSession: async () => undefined,
            }),
        ).resolves.toEqual({ directory, type: "requestToApproveDirectoryCreation" });
        expect(createSession).not.toHaveBeenCalled();
    });

    it("returns a retryable pending result after committing a session that is still syncing", async () => {
        const directory = await mkdtemp(join(tmpdir(), "rig-happy-spawn-pending-"));
        directories.push(directory);

        await expect(
            handleHappySpawnSession({
                createSession: vi.fn(),
                machineId: "rig-machine",
                modelCatalog: catalog,
                params: {
                    agent: "rig",
                    clientRequestId: "mobile-request-pending",
                    directory,
                    type: "spawn-in-directory",
                },
                waitForRemoteSession: async () => undefined,
            }),
        ).resolves.toEqual({
            clientRequestId: "mobile-request-pending",
            retryAfterMs: 2_000,
            type: "pending",
        });
    });
});
