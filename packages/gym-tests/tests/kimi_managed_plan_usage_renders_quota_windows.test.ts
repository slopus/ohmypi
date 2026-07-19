import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const running = new Set<Gym>();
const artifacts = resolve(import.meta.dirname, "../../artifacts/session-usage");

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("Kimi managed plan usage", () => {
    it("fetches the managed usages endpoint with the session bearer and renders quota windows", async () => {
        await mkdir(artifacts, { recursive: true });
        const gym = await createGym({
            mode: "docker",
            environment: {
                NO_PROXY: "host.docker.internal",
                RIG_KIMI_BASE_URL: "{{HTTP_PROXY_URL}}/coding/v1",
            },
            homeFiles: {
                ".kimi-code/credentials/kimi-code.json": JSON.stringify({
                    access_token: "wrong-default-token",
                    refresh_token: "wrong-default-refresh",
                }),
                ".rig/config.toml": [
                    "[providers.kimi]",
                    'auth_file = "/home/rig/kimi-managed.json"',
                    "",
                ].join("\n"),
                "kimi-managed.json": JSON.stringify({
                    access_token: "kimi-usage-token",
                    refresh_token: "kimi-usage-refresh",
                }),
            },
            httpProxy: {
                handler(request) {
                    const path = new URL(request.url).pathname;
                    if (request.method === "GET" && path === "/coding/v1/usages") {
                        return {
                            response: {
                                body: JSON.stringify({
                                    usage: {
                                        limit: 100,
                                        reset_at: new Date(
                                            Date.now() + 4 * 86_400_000,
                                        ).toISOString(),
                                        used: 14,
                                    },
                                    limits: [
                                        {
                                            detail: {
                                                duration: 5,
                                                limit: 50,
                                                reset_in: 12_000,
                                                timeUnit: "HOUR",
                                                used: 4,
                                            },
                                        },
                                    ],
                                }),
                                headers: { "content-type": "application/json" },
                                status: 200,
                            },
                        };
                    }
                    return { response: { body: "Unexpected quota request", status: 404 } };
                },
            },
            providerId: "kimi",
        });
        running.add(gym);

        submit(gym, "/usage");
        const report = await gym.terminal.waitForText("5-hour: 92% left", 30_000);
        expect(report.text).toContain("Kimi Code");
        expect(report.text).toContain("Weekly: 86% left · resets in 4d");
        expect(report.text).toContain("Session total: 0");
        const exchange = gym.httpProxy!.exchanges.find(
            (candidate) => new URL(candidate.request.url).pathname === "/coding/v1/usages",
        );
        expect(exchange?.request.method).toBe("GET");
        expect(exchange?.request.headers.authorization).toBe("Bearer kimi-usage-token");
        await gym.terminal.screenshot(`${artifacts}/kimi-managed-plan-usage.png`);
    }, 120_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}
