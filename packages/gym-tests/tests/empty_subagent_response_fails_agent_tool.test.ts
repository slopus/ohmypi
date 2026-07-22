import { afterEach, describe, expect, it } from "vitest";

import { createGym, type Gym } from "@slopus/rig-gym";

const EMPTY_SUBAGENT_RESPONSE_ERROR = "The subagent ran out of tokens before returning a response.";
const running = new Set<Gym>();

afterEach(async () => {
    await Promise.all([...running].map((gym) => gym.dispose()));
    running.clear();
});

describe("empty subagent responses", () => {
    it("fails the foreground agent tool with a specific error", async () => {
        let parentSessionId: string | undefined;
        let parentObservedToolError = false;
        const gym = await createGym({
            homeFiles: {
                ".kimi-code/credentials/kimi-code.json": JSON.stringify({
                    access_token: "kimi-test-token",
                    refresh_token: "kimi-refresh-token",
                }),
            },
            inference(request) {
                if (request.options.sessionId?.endsWith(":title") === true) {
                    return { content: [{ text: "Empty subagent response", type: "text" }] };
                }
                const sessionId = request.options.sessionId;
                expect(sessionId).toBeTypeOf("string");

                if (parentSessionId === undefined) {
                    parentSessionId = sessionId;
                    return {
                        content: [
                            {
                                arguments: {
                                    context: "task",
                                    description: "Return an empty response",
                                    prompt: "Finish without returning any response content.",
                                    run_in_background: false,
                                },
                                id: "empty-agent-call",
                                name: "Agent",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                if (sessionId !== parentSessionId) return { content: [] };

                const lastMessage = request.context.messages.at(-1);
                expect(lastMessage).toMatchObject({
                    isError: true,
                    role: "toolResult",
                    toolName: "Agent",
                });
                expect(messageText(lastMessage)).toContain(EMPTY_SUBAGENT_RESPONSE_ERROR);
                parentObservedToolError = true;
                return {
                    content: [{ text: "PARENT_OBSERVED_EMPTY_SUBAGENT_ERROR", type: "text" }],
                };
            },
            providerId: "kimi",
            providerOverrides: ["kimi"],
            rows: 28,
        });
        running.add(gym);

        gym.terminal.type("Delegate work that returns no response.");
        gym.terminal.press("enter");

        const result = await gym.terminal.waitForText(
            "PARENT_OBSERVED_EMPTY_SUBAGENT_ERROR",
            30_000,
        );
        expect(parentObservedToolError).toBe(true);
        expect(result.text).toContain(EMPTY_SUBAGENT_RESPONSE_ERROR);
        expect(result.text).toContain('"Return an empty response" failed in');
    }, 120_000);

    it("preserves a provider error instead of relabeling it as token exhaustion", async () => {
        let parentSessionId: string | undefined;
        let parentObservedProviderError = false;
        const providerError = "Our servers are currently overloaded.";
        const gym = await createGym({
            homeFiles: {
                ".kimi-code/credentials/kimi-code.json": JSON.stringify({
                    access_token: "kimi-test-token",
                    refresh_token: "kimi-refresh-token",
                }),
            },
            inference(request) {
                if (request.options.sessionId?.endsWith(":title") === true) {
                    return { content: [{ text: "Provider error subagent", type: "text" }] };
                }
                const sessionId = request.options.sessionId;
                expect(sessionId).toBeTypeOf("string");

                if (parentSessionId === undefined) {
                    parentSessionId = sessionId;
                    return {
                        content: [
                            {
                                arguments: {
                                    context: "task",
                                    description: "Encounter a provider error",
                                    prompt: "Attempt the delegated work.",
                                    run_in_background: false,
                                },
                                id: "provider-error-agent-call",
                                name: "Agent",
                                type: "toolCall",
                            },
                        ],
                    };
                }

                if (sessionId !== parentSessionId) {
                    return {
                        content: [],
                        errorMessage: providerError,
                        providerError: { type: "server_overloaded" },
                        stopReason: "error",
                    };
                }

                const lastMessage = request.context.messages.at(-1);
                expect(lastMessage).toMatchObject({
                    isError: true,
                    role: "toolResult",
                    toolName: "Agent",
                });
                expect(messageText(lastMessage)).toContain(providerError);
                expect(messageText(lastMessage)).not.toContain(EMPTY_SUBAGENT_RESPONSE_ERROR);
                parentObservedProviderError = true;
                return {
                    content: [{ text: "PARENT_OBSERVED_PROVIDER_ERROR", type: "text" }],
                };
            },
            providerId: "kimi",
            providerOverrides: ["kimi"],
            rows: 28,
        });
        running.add(gym);

        gym.terminal.type("Delegate work that encounters a provider error.");
        gym.terminal.press("enter");

        const result = await gym.terminal.waitForText("PARENT_OBSERVED_PROVIDER_ERROR", 30_000);
        expect(parentObservedProviderError).toBe(true);
        expect(result.text).toContain(providerError);
        expect(result.text).not.toContain(EMPTY_SUBAGENT_RESPONSE_ERROR);
        expect(result.text).toContain('"Encounter a provider error" failed in');
    }, 120_000);
});

function messageText(
    message: { content: string | readonly { text?: string; type: string }[] } | undefined,
): string {
    if (message === undefined) return "";
    if (typeof message.content === "string") return message.content;
    return message.content
        .filter((block): block is { text: string; type: string } => typeof block.text === "string")
        .map((block) => block.text)
        .join("\n");
}
