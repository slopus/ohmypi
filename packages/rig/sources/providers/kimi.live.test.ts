import { resolve } from "node:path";

import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { createNodeAgentContext, runAgentLoop } from "../agent/index.js";
import { defineTool } from "../agent/types.js";
import { NativeProcessManager } from "../processes/index.js";
import { kimiAgentTool, kimiCodeTools, kimiGoalTools } from "../tools/kimi/index.js";
import { createKimiProvider } from "./kimi.js";
import { modelMoonshotKimiK3 } from "./models.js";
import { resolveKimiCredential } from "./resolveKimiCredential.js";
import type { AssistantMessage, TextContent } from "./types.js";

const LIVE = process.env.RIG_LIVE_TEST === "1";
const describeLive = LIVE ? describe : describe.skip;

describeLive("Kimi K3 provider live", () => {
    it("streams max-reasoning inference using the Kimi Code authentication store", async () => {
        await expect(resolveKimiCredential()).resolves.toMatchObject({
            token: expect.any(String),
        });

        const stream = createKimiProvider({
            sessionId: `kimi-live-${Date.now()}`,
        }).stream(
            modelMoonshotKimiK3,
            {
                systemPrompt: "Follow the user's requested output exactly.",
                messages: [
                    {
                        role: "user",
                        content: "Reply with exactly: kimi k3 live ok",
                        timestamp: Date.now(),
                    },
                ],
            },
            { thinking: "max" },
        );
        let sawReasoning = false;
        let sawText = false;
        for await (const event of stream) {
            if (event.type === "thinking_delta" && event.delta.length > 0) sawReasoning = true;
            if (event.type === "text_delta" && event.delta.length > 0) sawText = true;
            if (event.type === "error") {
                throw new Error(event.error.errorMessage ?? "Kimi K3 stream failed");
            }
        }

        const message = await stream.result();
        expect(sawReasoning).toBe(true);
        expect(sawText).toBe(true);
        expect(message.stopReason).not.toBe("error");
        expect(textFromAssistantMessage(message).trim().toLowerCase()).toBe("kimi k3 live ok");
    }, 120_000);

    it("accepts every real Rig Kimi tool schema in one request", async () => {
        const tools = [...kimiCodeTools, kimiAgentTool, ...kimiGoalTools].map((tool) => ({
            description: tool.description,
            name: tool.name,
            parameters: tool.arguments,
        }));
        const stream = createKimiProvider({
            sessionId: `kimi-live-schemas-${Date.now()}`,
        }).stream(
            modelMoonshotKimiK3,
            {
                systemPrompt: "Follow the user's requested output exactly.",
                messages: [
                    {
                        role: "user",
                        content: "Do not use any tool. Reply with exactly: kimi tools ok",
                        timestamp: Date.now(),
                    },
                ],
                tools,
            },
            { thinking: "max" },
        );
        for await (const event of stream) {
            if (event.type === "error") {
                throw new Error(event.error.errorMessage ?? "Kimi K3 tool schema stream failed");
            }
        }

        const message = await stream.result();
        expect(message.errorMessage).toBeUndefined();
        expect(["stop", "toolUse"]).toContain(message.stopReason);
    }, 120_000);

    it("calls a function tool and continues with its result", async () => {
        let executionCount = 0;
        const liveProbeTool = defineTool({
            name: "LiveProbe",
            label: "Live probe",
            description: "Return a deterministic value for the Kimi K3 live test.",
            arguments: Type.Object({
                value: Type.String({ description: "The value to acknowledge." }),
            }),
            returnType: Type.Object({ acknowledgement: Type.String() }),
            shouldReviewInAutoMode: () => false,
            execute: ({ value }) => {
                executionCount += 1;
                return { acknowledgement: `Acknowledged: ${value}` };
            },
            toLLM: ({ acknowledgement }) => [{ type: "text", text: acknowledgement }],
            toUI: ({ acknowledgement }) => acknowledgement,
            locks: [],
        });
        const context = createNodeAgentContext({
            cwd: resolve(process.cwd(), "../.."),
            processManager: new NativeProcessManager(),
        });
        const sessionId = `kimi-tool-live-${Date.now()}`;
        const result = await runAgentLoop({
            provider: createKimiProvider({ sessionId }),
            modelId: modelMoonshotKimiK3.id,
            effort: "max",
            tools: [liveProbeTool],
            instructions:
                'Call LiveProbe exactly once with the value "tool path ok". After receiving its result, reply with exactly: kimi tool ok',
            messages: [
                {
                    role: "user",
                    id: "kimi-live-tool-user",
                    blocks: [
                        {
                            type: "text",
                            text: 'Use LiveProbe with "tool path ok", then reply with exactly: kimi tool ok',
                        },
                    ],
                },
            ],
            sessionId,
            context,
        });

        expect(result.stopReason).toBe("stop");
        expect(executionCount).toBe(1);
        expect(result.messages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "agent",
                    blocks: expect.arrayContaining([
                        expect.objectContaining({ type: "tool_call", name: "LiveProbe" }),
                    ]),
                }),
                expect.objectContaining({
                    role: "agent",
                    blocks: expect.arrayContaining([
                        expect.objectContaining({ type: "tool_result", toolName: "LiveProbe" }),
                    ]),
                }),
            ]),
        );
        const finalText = result.messages
            .filter((message) => message.role === "agent")
            .flatMap((message) => message.blocks)
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");
        expect(finalText.toLowerCase()).toContain("kimi tool ok");
    }, 180_000);
});

describe("Kimi K3 provider live prerequisites", () => {
    it("has usable local authentication when live tests are enabled", async () => {
        if (LIVE) {
            await expect(resolveKimiCredential()).resolves.toMatchObject({
                token: expect.any(String),
            });
        }
        expect(true).toBe(true);
    });
});

function textFromAssistantMessage(message: AssistantMessage): string {
    return message.content
        .filter((block): block is TextContent => block.type === "text")
        .map((block) => block.text)
        .join("");
}
