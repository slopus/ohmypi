import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const rig = "node /app/packages/rig/dist/main.js";
const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("Kimi K3 model switching", () => {
    it("rebuilds provider prompts and tools, persists Codex, then switches back to Kimi", async () => {
        let agentCallIndex = 0;
        const gym = await createGym({
            environment: { KIMI_API_KEY: "kimi-test-key" },
            homeFiles: {
                ".codex/auth.json": JSON.stringify({
                    tokens: { access_token: "codex-test-token" },
                }),
            },
            mode: "docker",
            entrypoint: [
                "bash",
                "-lc",
                `${rig}; echo KIMI_SWITCH_RESUMED; exec ${rig} resume --last`,
            ],
            inference(request) {
                if (request.options.sessionId?.endsWith(":title") === true) {
                    return { content: [{ text: "Kimi switch", type: "text" }] };
                }
                const callIndex = agentCallIndex++;
                if (callIndex === 0) {
                    expect(request.providerId).toBe("kimi");
                    expect(request.options.thinking).toBe("max");
                    expect(request.context.systemPrompt).toContain(
                        "You are Kimi Code, operating as Rig",
                    );
                    expect(request.context.tools?.map((tool) => tool.name)).toContain("Read");
                    expect(
                        request.context.tools?.find((tool) => tool.name === "Read")?.description,
                    ).toContain("If the user provides a concrete file path, call Read directly");
                    return {
                        content: [
                            { thinking: "Kimi reasoning retained.", type: "thinking" },
                            { text: "KIMI_INITIAL_TURN", type: "text" },
                        ],
                    };
                }
                if (callIndex === 1) {
                    expect(request.providerId).toBe("codex");
                    expect(request.modelId).toBe("openai/gpt-5.6-sol");
                    expect(request.options.thinking).toBe("low");
                    expect(request.context.systemPrompt).not.toContain(
                        "You are Kimi Code, operating as Rig",
                    );
                    expect(
                        request.context.tools?.find((tool) => tool.name === "Read")?.description ??
                            "",
                    ).not.toContain(
                        "If the user provides a concrete file path, call Read directly",
                    );
                    expect(request.context.tools?.map((tool) => tool.name)).toContain(
                        "read_agent_history",
                    );
                    const context = JSON.stringify(request.context.messages);
                    expect(request.context.systemPrompt).toContain(
                        "investigate the prior Rig agent history",
                    );
                    expect(request.context.systemPrompt).toContain("read_agent_history");
                    expect(request.context.systemPrompt).toContain("KIMI_INITIAL_TURN");
                    expect(request.context.systemPrompt).toContain("Kimi reasoning retained.");
                    expect(request.context.systemPrompt?.toLocaleLowerCase()).not.toContain(
                        "handoff",
                    );
                    expect(context).not.toContain("KIMI_INITIAL_TURN");
                    return {
                        content: [
                            {
                                arguments: {},
                                id: "read-kimi-history",
                                name: "read_agent_history",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                if (callIndex === 2) {
                    expect(request.providerId).toBe("codex");
                    const history = JSON.stringify(request.context.messages.at(-1));
                    expect(history).toContain("KIMI_INITIAL_TURN");
                    expect(history).toContain("Kimi reasoning retained.");
                    return {
                        content: [
                            {
                                encrypted: JSON.stringify({
                                    id: "reasoning-2",
                                    type: "reasoning",
                                }),
                                thinking: "Codex reasoning.",
                                type: "thinking",
                            },
                            { text: "CODEX_AFTER_SWITCH", type: "text" },
                        ],
                    };
                }

                if (callIndex === 3) {
                    expect(request.providerId).toBe("codex");
                    expect(JSON.stringify(request.context.messages)).toContain(
                        "CODEX_AFTER_SWITCH",
                    );
                    return { content: [{ text: "CODEX_AFTER_RESUME", type: "text" }] };
                }

                if (callIndex === 4) {
                    expect(request.providerId).toBe("kimi");
                    expect(request.options.thinking).toBe("max");
                    expect(request.context.systemPrompt).toContain(
                        "You are Kimi Code, operating as Rig",
                    );
                    expect(request.context.tools?.map((tool) => tool.name)).toContain("Read");
                    expect(
                        request.context.tools?.find((tool) => tool.name === "Read")?.description,
                    ).toContain("If the user provides a concrete file path, call Read directly");
                    const context = JSON.stringify(request.context.messages);
                    expect(request.context.systemPrompt).toContain(
                        "investigate the prior Rig agent history",
                    );
                    expect(request.context.systemPrompt).toContain("CODEX_AFTER_SWITCH");
                    expect(request.context.systemPrompt).toContain("CODEX_AFTER_RESUME");
                    expect(request.context.systemPrompt?.toLocaleLowerCase()).not.toContain(
                        "handoff",
                    );
                    expect(context).not.toContain("CODEX_AFTER_SWITCH");
                    expect(context).not.toContain("CODEX_AFTER_RESUME");
                    return {
                        content: [
                            {
                                arguments: {},
                                id: "read-codex-history",
                                name: "read_agent_history",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                expect(callIndex).toBe(5);
                expect(request.providerId).toBe("kimi");
                expect(request.options.thinking).toBe("max");
                const history = JSON.stringify(request.context.messages.at(-1));
                expect(history).toContain("CODEX_AFTER_SWITCH");
                expect(history).toContain("CODEX_AFTER_RESUME");
                return { content: [{ text: "KIMI_AFTER_SWITCH_BACK", type: "text" }] };
            },
            providerId: "kimi",
            providerOverrides: ["kimi", "codex"],
            rows: 28,
        });
        running.add(gym);

        submit(gym, "Start with Kimi.");
        await waitForIdleResponse(gym, "KIMI_INITIAL_TURN");

        submit(gym, "/model");
        await gym.terminal.waitForText("Choose Model", 30_000);
        gym.terminal.press("down");
        gym.terminal.press("down");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("Choose Reasoning", 30_000);
        gym.terminal.press("enter");
        await gym.terminal.waitForText("gpt-5.6-sol low · /workspace", 30_000);

        submit(gym, "Continue with Codex.");
        await waitForIdleResponse(gym, "CODEX_AFTER_SWITCH");
        gym.terminal.press("ctrlD");
        await gym.terminal.waitForText("KIMI_SWITCH_RESUMED", 30_000);
        await gym.terminal.waitForText("gpt-5.6-sol low · /workspace", 30_000);
        submit(gym, "Verify Codex after resume.");
        await waitForIdleResponse(gym, "CODEX_AFTER_RESUME");

        submit(gym, "/model");
        await gym.terminal.waitForText("Choose Model", 30_000);
        gym.terminal.press("up");
        gym.terminal.press("up");
        gym.terminal.press("enter");
        await gym.terminal.waitForText("Choose Reasoning", 30_000);
        gym.terminal.press("enter");
        await gym.terminal.waitForText("kimi-k3 max · /workspace", 30_000);
        submit(gym, "Switch back to Kimi.");
        const result = await gym.terminal.waitForText("KIMI_AFTER_SWITCH_BACK", 30_000);
        expect(result.text).toContain("kimi-k3 max");
        expect(agentCallIndex).toBe(6);
    }, 180_000);
});

function submit(gym: Gym, text: string): void {
    gym.terminal.type(text);
    gym.terminal.press("enter");
}

async function waitForIdleResponse(gym: Gym, response: string): Promise<void> {
    await gym.terminal.waitUntil(
        (snapshot) =>
            snapshot.text.includes(response) &&
            snapshot.text.includes("Ask Rig to do anything") &&
            !snapshot.text.includes("esc to interrupt"),
        `idle response ${response}`,
        30_000,
    );
}
