import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";
import { decryptHappyPayload } from "../../rig/sources/happy/happyEncryption.js";

const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("Happy machine registration", () => {
    it("publishes a distinct persistent Rig-only machine with the launch catalog", async () => {
        const secret = new Uint8Array(32).fill(7);
        let registeredMachine: { id: string; metadata: unknown } | undefined;
        const gym = await createGym({
            environment: {
                NO_PROXY: "127.0.0.1,localhost",
                RIG_HAPPY_SERVER_URL: "{{HTTP_PROXY_URL}}",
            },
            homeFiles: {
                ".happy/access.key": JSON.stringify({
                    secret: Buffer.from(secret).toString("base64"),
                    token: "happy-gym-token",
                }),
                ".happy/settings.json": JSON.stringify({ machineId: "native-happy-machine" }),
            },
            httpProxy: {
                handler(request) {
                    const url = new URL(request.url);
                    const json = (value: unknown) => ({
                        response: {
                            body: JSON.stringify(value),
                            headers: { "content-type": "application/json" },
                            status: 200,
                        },
                    });
                    if (request.method === "POST" && url.pathname === "/v1/machines") {
                        const body = JSON.parse(Buffer.from(request.body).toString("utf8")) as {
                            id: string;
                            metadata: string;
                        };
                        registeredMachine = {
                            id: body.id,
                            metadata: decryptHappyPayload(
                                secret,
                                "legacy",
                                Buffer.from(body.metadata, "base64"),
                            ),
                        };
                        return json({
                            machine: {
                                daemonStateVersion: 0,
                                id: body.id,
                                metadata: body.metadata,
                                metadataVersion: 0,
                            },
                        });
                    }
                    if (request.method === "POST" && url.pathname === "/v1/sessions") {
                        const body = JSON.parse(Buffer.from(request.body).toString("utf8")) as {
                            metadata: string;
                        };
                        return json({
                            session: {
                                id: "happy-session-1",
                                metadata: body.metadata,
                                metadataVersion: 0,
                            },
                        });
                    }
                    if (url.pathname === "/v3/sessions/happy-session-1/messages") {
                        return json({ hasMore: false, messages: [] });
                    }
                    return { response: { body: "Not found", status: 404 } };
                },
            },
            inference: [
                { content: [{ text: "Rig stayed available after registration.", type: "text" }] },
            ],
            timeoutMs: 30_000,
        });
        running.add(gym);

        gym.terminal.type("Verify the Rig Happy machine registration.");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("Rig stayed available after registration.", 30_000);

        expect(registeredMachine?.id).not.toBe("native-happy-machine");
        expect(registeredMachine?.metadata).toMatchObject({
            capabilities: { newSession: true, resume: false, worktrees: false },
            cliAvailability: {
                claude: false,
                codex: false,
                rig: true,
            },
            defaults: { permissionMode: "auto" },
            machineKind: "rig",
            models: expect.arrayContaining([
                expect.objectContaining({
                    id: "openai/gym",
                    name: "Gym",
                    providerId: "gym",
                }),
            ]),
            rigOnly: true,
            sessionCreation: {
                idempotencyKey: "clientRequestId",
                pendingRetryAfterMs: 2_000,
            },
        });
        const identity = await gym.runInContainer("node", [
            "-e",
            [
                'const fs=require("node:fs")',
                'const dir="/home/rig/.rig/happy/machines"',
                'const files=fs.readdirSync(dir).filter(file=>file.endsWith(".json"))',
                'process.stdout.write(JSON.parse(fs.readFileSync(`${dir}/${files[0]}`,"utf8")).id)',
            ].join(";"),
        ]);
        expect(identity.stdout).toBe(registeredMachine?.id);
    }, 60_000);
});
