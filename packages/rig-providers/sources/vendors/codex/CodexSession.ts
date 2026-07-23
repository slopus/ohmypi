import type OpenAI from "openai";
import type {
    ResponseCreateParamsStreaming,
    ResponseStreamEvent,
} from "openai/resources/responses/responses.js";
import { ResponsesWS } from "openai/resources/responses/ws";

import { BaseSession } from "@/core/BaseSession.js";
import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionEvent, SessionStream } from "@/core/SessionEvent.js";
import { isSessionErrorDone } from "@/core/SessionEvent.js";
import type { SessionRunRequest } from "@/core/SessionRunRequest.js";
import type { SessionSkill } from "@/core/SessionSkill.js";
import type { SessionTool } from "@/core/SessionTool.js";
import { withInitialSessionMessages } from "@/core/withInitialSessionMessages.js";
import { mapOpenAIResponseStream } from "@/responses/mapOpenAIResponseStream.js";
import type { CodexCredential } from "@/vendors/VendorCredential.js";
import { classifyCodexError } from "@/vendors/codex/impl/classifyCodexError.js";
import { createCodexClient } from "@/vendors/codex/impl/createCodexClient.js";
import { createCodexCliSseRequest } from "@/vendors/codex/impl/createCodexCliSseRequest.js";
import { createCodexCliWebSocketInferenceRequest } from "@/vendors/codex/impl/createCodexCliWebSocketInferenceRequest.js";
import {
    createCodexCliRequest,
    createCodexCliWarmupRequest,
} from "@/vendors/codex/impl/createCodexCliRequest.js";
import { createCodexWebSocketStream } from "@/vendors/codex/impl/createCodexWebSocketStream.js";
import { getCodexIncrementalInput } from "@/vendors/codex/impl/getCodexIncrementalInput.js";
import { context_checkpoint_compaction } from "@/vendors/codex/prompts/context_checkpoint_compaction.js";
import type { CodexTransport } from "@/vendors/codex/impl/codexConstants.js";

export interface CodexSessionOptions {
    context: SessionContext;
    credential: CodexCredential;
    endpoint: string;
    model?: string;
    skills?: readonly SessionSkill[];
    tools?: readonly SessionTool[];
    transport?: CodexTransport;
}

export class CodexSession extends BaseSession {
    readonly credential: CodexCredential;
    readonly endpoint: string;
    readonly model: string | undefined;
    readonly skills: readonly SessionSkill[];
    readonly tools: readonly SessionTool[];
    readonly transport: CodexTransport;

    private client: OpenAI | undefined;
    private activeModel: string | undefined;
    private context: SessionContext;
    private readonly initialMessages: SessionContext["messages"];
    private socket: ResponsesWS | undefined;
    private forceSse = false;
    private previousResponseId: string | undefined;
    private previousRequest: Record<string, unknown> | undefined;
    private previousResponseItems: readonly unknown[] = [];
    private websocketInferenceStarted = false;
    private websocketStarted = false;

    constructor(id: string, options: CodexSessionOptions) {
        super(id);
        this.credential = options.credential;
        this.context = {
            instructions: options.context.instructions,
            messages: [...options.context.messages],
        };
        this.initialMessages = [...options.context.messages];
        this.endpoint = options.endpoint;
        this.model = options.model;
        this.activeModel = options.model;
        this.skills = options.skills ?? [];
        this.tools = options.tools ?? [];
        this.transport = options.transport ?? "auto";
    }

    run(request: SessionRunRequest): SessionStream {
        if (request.abort?.aborted) return emptyStream();
        return this.streamRun(request);
    }

    async compact(signal?: AbortSignal): Promise<SessionContext> {
        const context = this.context;
        let summary = "";
        const messages = [
            ...context.messages.slice(this.initialMessages.length),
            { role: "user" as const, content: context_checkpoint_compaction },
        ];
        this.previousRequest = undefined;
        this.previousResponseId = undefined;
        this.previousResponseItems = [];
        for await (const event of this.run({
            context: { messages },
            ...(signal === undefined ? {} : { abort: signal }),
        })) {
            if (event.type === "text_delta") summary += event.delta;
            if (isSessionErrorDone(event)) throw new Error(`[${event.kind}] ${event.message}`);
        }
        if (signal?.aborted) return context;
        if (!summary.trim()) throw new Error("Compaction returned an empty summary.");
        this.context = {
            instructions: context.instructions,
            messages: [
                ...this.initialMessages,
                ...context.messages
                    .slice(this.initialMessages.length)
                    .filter((message) => message.role === "user"),
                {
                    role: "user",
                    content:
                        "Another language model started to solve this problem and produced a " +
                        "summary of its thinking process. You also have access to the state of " +
                        "the tools that were used by that language model. Use this to build on " +
                        "the work that has already been done and avoid duplicating work. Here " +
                        "is the summary produced by the other language model, use the information " +
                        `in this summary to assist with your own analysis:\n${summary.trim()}`,
                },
            ],
        };
        return this.context;
    }

    destroy(): void {
        this.closeSocket("session destroyed");
        this.client = undefined;
    }

    private async *streamRun(request: SessionRunRequest): AsyncGenerator<SessionEvent> {
        const model = request.model ?? this.activeModel;
        if (model === undefined) throw new Error("A model is required for Codex inference.");
        this.activeModel = model;
        const runMessages = [...request.context.messages];
        this.context = {
            instructions: this.context.instructions,
            messages: withInitialSessionMessages(this.initialMessages, runMessages),
        };
        const requestOptions = {
            context: this.context,
            model,
            ...(request.effort === undefined ? {} : { effort: request.effort }),
            promptCacheKey: this.id,
            skills: this.skills,
            tools: this.tools,
        };
        const payload = createCodexCliRequest(requestOptions);
        let useSse = this.transport === "sse" || (this.transport === "auto" && this.forceSse);
        for (;;) {
            let contentBegun = false;
            try {
                const stream = useSse
                    ? await this.sse(payload, this.tools, request.abort)
                    : this.websocket(payload, this.tools, request.abort);
                let assistantText = "";
                for await (const event of mapOpenAIResponseStream(stream, {
                    failureMessage: `${model} failed to generate a response.`,
                    ...(request.abort === undefined ? {} : { signal: request.abort }),
                })) {
                    if (event.type === "text_delta") assistantText += event.delta;
                    if (
                        event.type === "text_delta" ||
                        event.type === "tool_call_delta" ||
                        event.type === "server_tool_call_delta"
                    )
                        contentBegun = true;
                    yield event;
                    if (event.type === "done") {
                        if (event.state !== "error") {
                            if (assistantText.length > 0)
                                this.context = {
                                    instructions: this.context.instructions,
                                    messages: [
                                        ...this.context.messages,
                                        { role: "assistant", content: assistantText },
                                    ],
                                };
                        }
                        return;
                    }
                }
                return;
            } catch (error) {
                if (request.abort?.aborted) return;
                const message = error instanceof Error ? error.message : String(error);
                if (this.transport === "auto" && !useSse && !contentBegun) {
                    this.forceSse = true;
                    useSse = true;
                    this.closeSocket("falling back to SSE");
                    yield {
                        type: "retrying",
                        attempt: 1,
                        reason: `WebSocket unavailable; falling back to SSE: ${message}`,
                    };
                    continue;
                }
                yield { type: "done", state: "error", kind: classifyCodexError(message), message };
                return;
            }
        }
    }

    private resolveClient(): OpenAI {
        return (this.client ??= createCodexClient({
            credential: this.credential,
            endpoint: this.endpoint,
            sessionId: this.id,
        }));
    }

    private async sse(
        request: ResponseCreateParamsStreaming,
        tools: readonly SessionTool[],
        signal?: AbortSignal,
    ) {
        return this.resolveClient().responses.create(
            createCodexCliSseRequest(request, tools),
            ...(signal === undefined ? [] : [{ signal }]),
        );
    }

    private async *websocket(
        request: ResponseCreateParamsStreaming,
        tools: readonly SessionTool[],
        signal?: AbortSignal,
    ): AsyncGenerator<ResponseStreamEvent> {
        const client = this.resolveClient();
        this.socket ??= new ResponsesWS(client, { headers: this.websocketHeaders() });
        if (!this.websocketStarted) {
            for await (const event of createCodexWebSocketStream({
                client,
                request: createCodexCliWarmupRequest(request, tools),
                socket: this.socket,
                ...(signal === undefined ? {} : { signal }),
            })) {
                if (event.type === "response.completed")
                    this.previousResponseId = event.response.id;
            }
            this.websocketStarted = true;
        }
        const fullRequest = request as unknown as Record<string, unknown>;
        const incrementalInput = this.previousRequest === undefined
            ? undefined
            : getCodexIncrementalInput(
                  this.previousRequest,
                  this.previousResponseItems,
                  fullRequest,
              );
        const canContinue =
            !this.websocketInferenceStarted || incrementalInput !== undefined;
        const inferenceRequest =
            canContinue
                ? (createCodexCliWebSocketInferenceRequest(request) as unknown as Record<
                      string,
                      unknown
                  >)
                : structuredClone(fullRequest);
        if (incrementalInput !== undefined) inferenceRequest.input = incrementalInput;
        if (canContinue && this.previousResponseId !== undefined) {
            inferenceRequest.previous_response_id = this.previousResponseId;
        }
        this.websocketInferenceStarted = true;
        let responseItems: readonly unknown[] = [];
        for await (const event of createCodexWebSocketStream({
            client,
            request: inferenceRequest,
            socket: this.socket,
            ...(signal === undefined ? {} : { signal }),
        })) {
            if (event.type === "response.completed") {
                this.previousResponseId = event.response.id;
                responseItems = event.response.output ?? [];
                this.previousRequest = structuredClone(fullRequest);
                this.previousResponseItems = structuredClone(responseItems);
            }
            yield event;
        }
    }

    private websocketHeaders(): Record<string, string> {
        const token =
            this.credential.name === "codex-session"
                ? this.credential.credential.accessToken
                : this.credential.credential.apiKey;
        const accountId =
            this.credential.name === "codex-session"
                ? this.credential.credential.accountId
                : undefined;
        return {
            Authorization: `Bearer ${token}`,
            ...(accountId === undefined ? {} : { "chatgpt-account-id": accountId }),
            originator: "codex_cli_rs",
            "OpenAI-Beta": "responses_websockets=2026-02-06",
            "session-id": this.id,
            "x-client-request-id": this.id,
        };
    }

    private closeSocket(reason: string): void {
        if (this.socket?.socket.readyState !== undefined && this.socket.socket.readyState < 2)
            this.socket.close({ code: 1000, reason });
        this.socket = undefined;
    }
}

function emptyStream(): SessionStream {
    async function* stream(): AsyncGenerator<SessionEvent> {}
    return stream();
}
