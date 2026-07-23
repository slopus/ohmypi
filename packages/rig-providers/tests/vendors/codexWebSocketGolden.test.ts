import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

const websocket = vi.hoisted(() => ({ sent: [] as Record<string, any>[] }));

vi.mock("openai/resources/responses/ws", () => ({
    ResponsesWS: class MockResponsesWS {
        readonly socket = { readyState: 1 };
        private messages: any[] = [];

        send(request: Record<string, any>): void {
            websocket.sent.push(structuredClone(request));
            const serialized = JSON.stringify(request.input ?? []);
            if (serialized.includes("CONTEXT CHECKPOINT COMPACTION")) {
                this.messages.push({
                    type: "message",
                    message: {
                        type: "response.output_item.added",
                        output_index: 0,
                        item: {
                            id: "summary",
                            type: "message",
                            role: "assistant",
                            content: [],
                        },
                    },
                });
                this.messages.push({
                    type: "message",
                    message: {
                        type: "response.output_text.delta",
                        output_index: 0,
                        content_index: 0,
                        item_id: "summary",
                        delta: "A compact summary.",
                    },
                });
            }
            this.messages.push({
                type: "message",
                message: {
                    type: "response.completed",
                    response: {
                        id: websocket.sent.length === 1 ? "<PREVIOUS_RESPONSE_ID>" : "response",
                        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
                    },
                },
            });
        }

        close(): void {}

        [Symbol.asyncIterator](): AsyncIterator<any> {
            return {
                next: async () => ({ done: false, value: this.messages.shift() }),
                return: async () => ({ done: true, value: undefined }),
            };
        }
    },
}));

import {
    createCodexCliRequest,
    createCodexCliWarmupRequest,
} from "@/vendors/codex/impl/createCodexCliRequest.js";
import { createCodexCliWebSocketInferenceRequest } from "@/vendors/codex/impl/createCodexCliWebSocketInferenceRequest.js";
import { codexCliTools } from "./codexCliTools.js";
import { codexCliPrompt } from "./codexCliPrompt.js";
import { codexSkills, codexSkillsWithGithub } from "./codexSkills.js";
import { CodexProvider } from "@/vendors/codex/CodexProvider.js";

const cases = [
    ["gpt-5.5", "codex-gpt-5-5-low"],
    ["gpt-5.6-sol", "codex-gpt-5-6-sol-low"],
    ["gpt-5.6-terra", "codex-gpt-5-6-terra-low"],
    ["gpt-5.6-luna", "codex-gpt-5-6-luna-low"],
] as const;

describe("Codex CLI mode WebSocket goldens", () => {
    beforeEach(() => websocket.sent.splice(0));

    it.each(cases)("matches the official %s low-effort request contract", async (model, stem) => {
        const golden = await fixture(`${stem}.websocket.json`);
        const literalTools = await fixture(`${stem}.tools.json`);
        const prompt = codexCliPrompt(model, "websocket");
        expect(webSocketPromptEnvelope(golden.warmup, golden.request, false)).toEqual(prompt);
        const request = createCodexCliRequest({
            context: {
                instructions: prompt.instructions,
                messages: [
                    ...prompt.systemMessages.map((content) => ({
                        role: "system" as const,
                        content,
                    })),
                    { role: "user", content: "Reply with OK." },
                ],
            },
            effort: "low",
            model,
            promptCacheKey: "<SESSION_ID>",
            skills: model === "gpt-5.5" ? codexSkillsWithGithub : codexSkills,
            tools: codexCliTools(model),
        }) as unknown as Record<string, unknown>;
        const warmup = createCodexCliWarmupRequest(
            request as never,
            codexCliTools(model),
        ) as Record<string, unknown>;
        const inference = createCodexCliWebSocketInferenceRequest(
            request as never,
        ) as unknown as Record<string, unknown>;

        expect(protocolProjection(inference)).toEqual(protocolProjection(golden.request));
        expect(protocolProjection(warmup)).toEqual(protocolProjection(golden.warmup));
        expect(toolDefinitions(inference, warmup)).toEqual(literalTools);
        expect(webSocketPromptEnvelope(warmup, inference)).toEqual(
            webSocketPromptEnvelope(golden.warmup, golden.request),
        );
    });

    it.each(cases)("sends the captured %s request through a mocked WebSocket", async (model, stem) => {
        const golden = await fixture(`${stem}.websocket.json`);
        const prompt = codexCliPrompt(model, "websocket");
        expect(webSocketPromptEnvelope(golden.warmup, golden.request, false)).toEqual(prompt);
        const provider = new CodexProvider({
            credential: {
                name: "codex-session",
                credential: { accessToken: "test", accountId: "account" },
            } as never,
            endpoint: "http://localhost.invalid/backend-api/codex",
            model,
            transport: "websocket",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: {
                instructions: prompt.instructions,
                messages: prompt.systemMessages.map((content) => ({
                    role: "system" as const,
                    content,
                })),
            },
            skills: model === "gpt-5.5" ? codexSkillsWithGithub : codexSkills,
            tools: codexCliTools(model),
        });

        for await (const event of session.run({
            context: {
                messages: [
                    { role: "user", content: "Reply with OK." },
                ],
            },
            effort: "low",
        })) {
            if (event.type === "done") expect(event.state).toBe("normal");
        }

        expect(websocket.sent).toHaveLength(2);
        expect(protocolProjection(websocket.sent[0]!)).toEqual(protocolProjection(golden.warmup));
        expect(protocolProjection(websocket.sent[1]!)).toEqual(protocolProjection(golden.request));
        expect(websocket.sent[0]!.prompt_cache_key).toBe("<SESSION_ID>");
        expect(websocket.sent[1]!.prompt_cache_key).toBe("<SESSION_ID>");
        expect(websocket.sent[1]!.previous_response_id).toBe("<PREVIOUS_RESPONSE_ID>");
        expect(webSocketPromptEnvelope(websocket.sent[0]!, websocket.sent[1]!)).toEqual(
            webSocketPromptEnvelope(golden.warmup, golden.request),
        );
        expect(toolDefinitions(websocket.sent[1]!, websocket.sent[0]!)).toEqual(
            await fixture(`${stem}.tools.json`),
        );
        session.destroy();
    });

    it("continues from the last in-memory response when the rebuilt context extends its prefix", async () => {
        const prompt = codexCliPrompt("gpt-5.6-sol", "websocket");
        const provider = new CodexProvider({
            credential: {
                name: "codex-session",
                credential: { accessToken: "test", accountId: "account" },
            } as never,
            endpoint: "http://localhost.invalid/backend-api/codex",
            model: "gpt-5.6-sol",
            transport: "websocket",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: prompt.instructions, messages: [] },
            skills: codexSkills,
            tools: codexCliTools("gpt-5.6-sol"),
        });

        await drain(session.run({
            context: { messages: [{ role: "user", content: "first" }] },
            effort: "low",
        }));
        await drain(session.run({
            context: {
                messages: [
                    { role: "user", content: "first" },
                    { role: "user", content: "second" },
                ],
            },
            effort: "low",
        }));

        expect(websocket.sent).toHaveLength(3);
        expect(websocket.sent[2]!.previous_response_id).toBe("response");
        expect(websocket.sent[2]!.input).toEqual([
            {
                type: "message",
                role: "user",
                content: "second",
            },
        ]);
        session.destroy();
    });

    it("sends full context without a response id when the rebuilt prefix diverges", async () => {
        const prompt = codexCliPrompt("gpt-5.6-sol", "websocket");
        const provider = new CodexProvider({
            credential: {
                name: "codex-session",
                credential: { accessToken: "test", accountId: "account" },
            } as never,
            endpoint: "http://localhost.invalid/backend-api/codex",
            model: "gpt-5.6-sol",
            transport: "websocket",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: prompt.instructions, messages: [] },
            skills: codexSkills,
            tools: codexCliTools("gpt-5.6-sol"),
        });

        await drain(session.run({
            context: { messages: [{ role: "user", content: "first" }] },
            effort: "low",
        }));
        await drain(session.run({
            context: { messages: [{ role: "user", content: "replacement" }] },
            effort: "low",
        }));

        expect(websocket.sent[2]!.previous_response_id).toBeUndefined();
        expect(websocket.sent[2]!.input).toContainEqual({
            type: "message",
            role: "user",
            content: "replacement",
        });
        session.destroy();
    });

    it("allows a model change by starting a new full-context response chain", async () => {
        const prompt = codexCliPrompt("gpt-5.6-sol", "websocket");
        const provider = new CodexProvider({
            credential: {
                name: "codex-session",
                credential: { accessToken: "test", accountId: "account" },
            } as never,
            endpoint: "http://localhost.invalid/backend-api/codex",
            transport: "websocket",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: prompt.instructions, messages: [] },
            skills: codexSkills,
            tools: codexCliTools("gpt-5.6-sol"),
        });

        await drain(session.run({
            context: { messages: [{ role: "user", content: "first" }] },
            effort: "low",
            model: "gpt-5.6-sol",
        }));
        await drain(session.run({
            context: {
                messages: [
                    { role: "user", content: "first" },
                    { role: "user", content: "second" },
                ],
            },
            effort: "low",
            model: "gpt-5.6-terra",
        }));

        expect(websocket.sent[2]!.model).toBe("gpt-5.6-terra");
        expect(websocket.sent[2]!.previous_response_id).toBeUndefined();
        expect(websocket.sent[2]!.input).toContainEqual({
            type: "message",
            role: "user",
            content: "first",
        });
        expect(websocket.sent[2]!.input).toContainEqual({
            type: "message",
            role: "user",
            content: "second",
        });
        session.destroy();
    });

    it("restarts the response chain for compaction and a following model switch", async () => {
        const prompt = codexCliPrompt("gpt-5.6-sol", "websocket");
        const provider = new CodexProvider({
            credential: {
                name: "codex-session",
                credential: { accessToken: "test", accountId: "account" },
            } as never,
            endpoint: "http://localhost.invalid/backend-api/codex",
            transport: "websocket",
        });
        const session = await provider.session("<SESSION_ID>", {
            context: { instructions: prompt.instructions, messages: [] },
            skills: codexSkills,
            tools: codexCliTools("gpt-5.6-sol"),
        });
        await drain(session.run({
            context: { messages: [{ role: "user", content: "first" }] },
            effort: "low",
            model: "gpt-5.6-sol",
        }));
        await drain(session.run({
            context: {
                messages: [
                    { role: "user", content: "first" },
                    { role: "user", content: "second" },
                ],
            },
            effort: "low",
            model: "gpt-5.6-sol",
        }));
        const compacted = await session.compact();
        await drain(session.run({
            context: { messages: [...compacted.messages, { role: "user", content: "switched" }] },
            effort: "low",
            model: "gpt-5.6-terra",
        }));

        const compaction = websocket.sent[3]!;
        const switched = websocket.sent[4]!;
        expect(compaction.previous_response_id).toBeUndefined();
        expect(JSON.stringify(compaction.input)).toContain("CONTEXT CHECKPOINT COMPACTION");
        expect(switched.model).toBe("gpt-5.6-terra");
        expect(switched.previous_response_id).toBeUndefined();
        expect(JSON.stringify(switched.input)).toContain("A compact summary.");
        session.destroy();
    });
});

async function drain(stream: AsyncIterable<unknown>): Promise<void> {
    for await (const _event of stream) {
        // Drain the mocked response.
    }
}

async function fixture(name: string): Promise<any> {
    return JSON.parse(
        await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
    );
}

function protocolProjection(request: Record<string, any>): Record<string, unknown> {
    return {
        type: request.type ?? "response.create",
        model: request.model,
        tool_choice: request.tool_choice,
        parallel_tool_calls: request.parallel_tool_calls,
        reasoning: request.reasoning,
        store: request.store,
        stream: request.stream,
        include: request.include,
        text: request.text,
        generate: request.generate,
        hasInstructions: request.instructions !== undefined,
        hasTopLevelTools: request.tools !== undefined,
        inputTypes: Array.isArray(request.input)
            ? [...new Set(request.input.map((item: { type?: unknown }) => item.type))]
            : [],
    };
}

function toolDefinitions(request: Record<string, any>, warmup: Record<string, any>): unknown[] {
    if (Array.isArray(request.tools)) return request.tools;
    return (
        warmup.input?.find((item: { type?: unknown }) => item.type === "additional_tools")?.tools ??
        []
    );
}

function promptEnvelope(request: Record<string, any>, includeSkills = true): {
    instructions?: string;
    systemMessages: string[][];
} {
    const systemMessages = (request.input ?? [])
        .filter((item: { role?: unknown; type?: unknown }) =>
            item.type === "message" && item.role === "developer",
        )
        .map((item: any) =>
            (typeof item.content === "string" ? [item.content] : (item.content ?? []))
                .map((content: { text?: unknown } | string) =>
                    typeof content === "string" ? content : content.text,
                )
                .filter((text: unknown): text is string => typeof text === "string"),
        )
        .map((message: string[]) =>
            includeSkills
                ? message
                : message.filter((part) => !part.startsWith("<skills_instructions>")),
        )
        .filter((message: string[]) => message.length > 0);
    return {
        ...(typeof request.instructions === "string"
            ? { instructions: request.instructions }
            : {}),
        systemMessages,
    };
}

function webSocketPromptEnvelope(
    warmup: Record<string, any>,
    request: Record<string, any>,
    includeSkills = true,
): { instructions: string; systemMessages: string[][] } {
    const requestPrompt = promptEnvelope(request, includeSkills);
    const warmupPrompt = promptEnvelope(warmup, includeSkills);
    const instructions =
        requestPrompt.instructions ?? warmupPrompt.systemMessages.flat()[0];
    if (instructions === undefined) throw new Error("WebSocket capture omitted instructions.");
    return { instructions, systemMessages: requestPrompt.systemMessages };
}
