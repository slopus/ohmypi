import { PassThrough } from "node:stream";

import type Dockerode from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { createPermissionContext } from "../permissions/index.js";
import { SecretRegistry, SessionSecretContext } from "../secrets/index.js";
import { createDockerBashContext } from "./createDockerBashContext.js";
import type { DockerEnvironment } from "./DockerEnvironment.js";

describe("createDockerBashContext", () => {
    it("uses distinct pid files for contexts sharing a container", async () => {
        const fake = createFakeDockerEnvironment();
        const first = createDockerBashContext(
            fake.environment,
            createPermissionContext("full_access"),
        );
        const second = createDockerBashContext(
            fake.environment,
            createPermissionContext("full_access"),
        );

        await first.startSession({ command: "sleep 10" });
        await second.startSession({ command: "sleep 10" });

        const pidFiles = fake.foregroundCommands.map((command) => command[4]);
        expect(pidFiles).toHaveLength(2);
        expect(new Set(pidFiles).size).toBe(2);

        for (const stream of fake.foregroundStreams) stream.end();
        await Promise.all([
            first.readSession(1, { waitMs: 1_000 }),
            second.readSession(1, { waitMs: 1_000 }),
        ]);
    });

    it("applies the local backend's two-minute default to foreground runs", async () => {
        const fake = createFakeDockerEnvironment();
        const context = createDockerBashContext(
            fake.environment,
            createPermissionContext("full_access"),
        );
        const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

        try {
            const resultPromise = context.run({ command: "printf done" });
            await vi.waitFor(() => expect(fake.foregroundStreams).toHaveLength(1));

            expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 120_000)).toBe(true);
            fake.foregroundStreams[0]?.end();
            await expect(resultPromise).resolves.toMatchObject({ timedOut: false });
        } finally {
            timeoutSpy.mockRestore();
        }
    });

    it("keeps unread output deltas when capped buffers evict older bytes", async () => {
        const fake = createFakeDockerEnvironment();
        const context = createDockerBashContext(
            fake.environment,
            createPermissionContext("full_access"),
        );
        await context.startSession({ command: "stream output", maxOutputBytes: 5 });
        const stream = fake.foregroundStreams[0];
        stream?.write("abcde");

        await vi.waitFor(async () =>
            expect(await context.readSession(1)).toMatchObject({ stdoutDelta: "abcde" }),
        );
        stream?.write("fg");
        await vi.waitFor(async () =>
            expect(await context.readSession(1)).toMatchObject({ stdoutDelta: "fg" }),
        );

        stream?.end();
        await context.readSession(1, { waitMs: 1_000 });
    });

    it("handles container lookup failures while aborting a foreground run", async () => {
        const fake = createFakeDockerEnvironment();
        let containerRequests = 0;
        const environment = {
            config: { workingDirectory: "/workspace" },
            container: async () => {
                containerRequests += 1;
                if (containerRequests === 1) return fake.container;
                throw new Error("Docker socket unavailable during abort.");
            },
        } as unknown as DockerEnvironment;
        const context = createDockerBashContext(
            environment,
            createPermissionContext("full_access"),
        );
        const controller = new AbortController();
        const resultPromise = context.run({ command: "sleep 10", signal: controller.signal });
        await vi.waitFor(() => expect(fake.foregroundStreams).toHaveLength(1));

        controller.abort();

        await expect(resultPromise).resolves.toMatchObject({
            stderr: "Docker socket unavailable during abort.",
        });
    });

    it("passes only selected attached bundles through Docker exec", async () => {
        const fake = createFakeDockerEnvironment(["service_token=ambient-secret"]);
        const registry = new SecretRegistry([
            {
                description: "Service credentials",
                environment: {
                    SERVICE_REGION: "docker-region",
                    SERVICE_TOKEN: "docker-secret",
                },
                id: "service",
            },
            {
                description: "Database credentials",
                environment: { DATABASE_URL: "docker-database" },
                id: "database",
            },
        ]);
        const secrets = new SessionSecretContext(registry, ["service"], ["database"]);
        const context = createDockerBashContext(
            fake.environment,
            createPermissionContext("full_access"),
            secrets,
        );

        await context.startSession({ command: "secrets-omitted" });
        fake.foregroundStreams[0]?.end();
        await context.readSession(1, { waitMs: 1_000 });

        await context.startSession({ command: "secrets-empty", secrets: [] });
        fake.foregroundStreams[1]?.end();
        await context.readSession(2, { waitMs: 1_000 });

        await context.startSession({ command: "service-secret", secrets: ["service"] });
        fake.foregroundStreams[2]?.end();
        await context.readSession(3, { waitMs: 1_000 });

        await context.startSession({
            command: "all-selected-secrets",
            secrets: ["service", "database"],
        });

        expect(fake.foregroundEnvironments).toEqual([
            ["SERVICE_REGION=", "SERVICE_TOKEN=", "DATABASE_URL=", "service_token="],
            ["SERVICE_REGION=", "SERVICE_TOKEN=", "DATABASE_URL=", "service_token="],
            [
                "SERVICE_REGION=docker-region",
                "SERVICE_TOKEN=docker-secret",
                "DATABASE_URL=",
                "service_token=",
            ],
            [
                "SERVICE_REGION=docker-region",
                "SERVICE_TOKEN=docker-secret",
                "DATABASE_URL=docker-database",
                "service_token=",
            ],
        ]);
        expect(fake.foregroundCommands[3]).not.toContain("docker-secret");
        expect(fake.foregroundCommands[3]).not.toContain("docker-database");
        fake.foregroundStreams[3]?.end();
        await context.readSession(4, { waitMs: 1_000 });
    });
});

function createFakeDockerEnvironment(environmentVariables: readonly string[] = []): {
    container: Dockerode.Container;
    environment: DockerEnvironment;
    foregroundCommands: string[][];
    foregroundEnvironments: string[][];
    foregroundStreams: PassThrough[];
} {
    const foregroundCommands: string[][] = [];
    const foregroundEnvironments: string[][] = [];
    const foregroundStreams: PassThrough[] = [];
    const container = {
        async inspect() {
            return { Config: { Env: [...environmentVariables] } };
        },
        async exec(options: { AttachStdin?: boolean; Cmd?: string[]; Env?: string[] }) {
            const stream = new PassThrough();
            if (options.AttachStdin === true) {
                foregroundCommands.push(options.Cmd ?? []);
                foregroundEnvironments.push(options.Env ?? []);
                foregroundStreams.push(stream);
            } else {
                queueMicrotask(() => stream.end());
            }
            return {
                inspect: async () => ({ ExitCode: 0 }),
                start: async () => stream,
            };
        },
        modem: {
            demuxStream(
                stream: NodeJS.ReadableStream,
                stdout: NodeJS.WritableStream,
                _stderr: NodeJS.WritableStream,
            ) {
                stream.pipe(stdout);
            },
        },
    } as unknown as Dockerode.Container;
    return {
        container,
        environment: {
            config: { workingDirectory: "/workspace" },
            container: async () => container,
        } as unknown as DockerEnvironment,
        foregroundCommands,
        foregroundEnvironments,
        foregroundStreams,
    };
}
