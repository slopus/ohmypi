import { BaseSession } from "@/core/BaseSession.js";
import { addSessionCacheUsage } from "@/core/addSessionCacheUsage.js";
import type { SessionCacheUsage } from "@/core/SessionCacheUsage.js";
import type { SessionCompaction, SessionCompactionOptions } from "@/core/SessionCompaction.js";
import type { SessionContext, SessionToolCall } from "@/core/SessionContext.js";
import type { SessionEvent, SessionStream } from "@/core/SessionEvent.js";
import type { SessionModelConfiguration } from "@/core/SessionModelConfiguration.js";
import type { SessionReasoningEffort, SessionRunRequest } from "@/core/SessionRunRequest.js";
import type { SessionSkill } from "@/core/SessionSkill.js";
import type { SessionTool } from "@/core/SessionTool.js";
import { withInitialSessionMessages } from "@/core/withInitialSessionMessages.js";
import type { BedrockCredential } from "@/vendors/VendorCredential.js";
import type { AnthropicBedrockCompactionVendor } from "@/vendors/bedrock/AnthropicBedrockCompactionVendor.js";
import type { AnthropicBedrockTransport } from "@/vendors/bedrock/AnthropicBedrockTransport.js";
import {
    describeAnthropicBedrockRetry,
    resolveAnthropicBedrockRetryDelay,
    shouldRetryAnthropicBedrock,
    waitForAnthropicBedrockRetry,
} from "@/vendors/bedrock/impl/anthropicBedrockRetry.js";
import { classifyAnthropicBedrockError } from "@/vendors/bedrock/impl/classifyAnthropicBedrockError.js";
import { createAnthropicBedrockClient } from "@/vendors/bedrock/impl/createAnthropicBedrockClient.js";
import type { AnthropicBedrockClient as CreatedAnthropicBedrockClient } from "@/vendors/bedrock/impl/createAnthropicBedrockClient.js";
import { createAnthropicBedrockRequest } from "@/vendors/bedrock/impl/createAnthropicBedrockRequest.js";
import { mapAnthropicBedrockStream } from "@/vendors/bedrock/impl/mapAnthropicBedrockStream.js";
import { requestAnthropicBedrockCompaction } from "@/vendors/bedrock/impl/requestAnthropicBedrockCompaction.js";
import { resolveAnthropicBedrockModelId } from "@/vendors/bedrock/impl/resolveAnthropicBedrockModelId.js";
import { restoreAnthropicBedrockCompaction } from "@/vendors/bedrock/impl/restoreAnthropicBedrockCompaction.js";
import { resolveClaudeTools } from "@/vendors/claude/impl/resolveClaudeTools.js";

const COMPACTION_PROMPT =
    "Summarize the conversation for continuation. Preserve user requests, decisions, exact identifiers, unfinished work, and tool outcomes. Output only the summary.";
const NATIVE_COMPACTION_TRIGGER_TOKENS = 50_000;

export type AnthropicBedrockClient = CreatedAnthropicBedrockClient;

export interface AnthropicBedrockSessionOptions {
    client?: AnthropicBedrockClient;
    context: SessionContext;
    credential: BedrockCredential;
    endpoint?: string;
    model?: string;
    modelConfigurations?: Readonly<Record<string, SessionModelConfiguration>>;
    region: string;
    skills?: readonly SessionSkill[];
    tools?: readonly SessionTool[];
    transport: AnthropicBedrockTransport;
}

export class AnthropicBedrockSession extends BaseSession {
    readonly credential: BedrockCredential;
    readonly endpoint: string | undefined;
    readonly model: string | undefined;
    readonly region: string;
    readonly skills: readonly SessionSkill[] | undefined;
    readonly tools: readonly SessionTool[] | undefined;
    readonly transport: AnthropicBedrockTransport;

    private activeEffort: SessionReasoningEffort | undefined;
    private activeModel: string | undefined;
    private client: AnthropicBedrockClient | undefined;
    private context: SessionContext;
    private readonly fixedMessages: SessionContext["messages"];
    private readonly modelConfigurations:
        | Readonly<Record<string, SessionModelConfiguration>>
        | undefined;

    constructor(id: string, options: AnthropicBedrockSessionOptions) {
        super(id);
        this.credential = options.credential;
        this.endpoint = options.endpoint;
        this.model = options.model;
        this.activeModel = options.model;
        this.region = options.region;
        this.skills = options.skills;
        this.tools = options.tools;
        this.transport = options.transport;
        this.modelConfigurations = options.modelConfigurations;
        this.client = options.client;
        this.context = {
            instructions: options.context.instructions,
            messages: [...options.context.messages],
        };
        this.fixedMessages = options.context.messages.filter(
            (message) => message.role === "system",
        );
    }

    run(request: SessionRunRequest): SessionStream {
        if (request.abort?.aborted) return emptyStream();
        return this.streamRun(request);
    }

    async compact(options: SessionCompactionOptions = {}): Promise<SessionCompaction> {
        const original =
            options.context === undefined
                ? this.context
                : {
                      instructions: this.context.instructions,
                      messages: restoreAnthropicBedrockCompaction(
                          this.context.messages,
                          withInitialSessionMessages(this.fixedMessages, options.context.messages),
                      ),
                  };
        if (options.signal?.aborted) return { status: "cancelled", context: original };
        const model = this.activeModel ?? this.model;
        if (model === undefined) {
            throw new Error("A model is required for Anthropic Bedrock compaction.");
        }
        const instructions = options.instructions?.trim();
        const prompt =
            instructions === undefined || instructions.length === 0
                ? COMPACTION_PROMPT
                : `${COMPACTION_PROMPT}\n\nRetention instructions:\n${instructions}`;
        let nativeUsage: SessionCacheUsage | undefined;
        if ((options.inputTokens ?? 0) >= NATIVE_COMPACTION_TRIGGER_TOKENS) {
            try {
                const native = await requestAnthropicBedrockCompaction({
                    client: this.resolveClient(),
                    request: this.createRequest({
                        compactionInstructions: prompt,
                        context: original,
                        model,
                        tools: [],
                        ...(this.activeEffort === undefined ? {} : { effort: this.activeEffort }),
                    }),
                    ...(options.signal === undefined ? {} : { signal: options.signal }),
                });
                nativeUsage = native.usage;
                if (options.signal?.aborted) return { status: "cancelled", context: original };
                const content = native.block?.content?.trim();
                if (content) {
                    const vendor: AnthropicBedrockCompactionVendor = {
                        type: "anthropic_compaction",
                        encryptedContent: native.block?.encrypted_content ?? null,
                    };
                    const compaction = {
                        role: "compaction" as const,
                        content,
                        vendor,
                    };
                    const preservedMessages = [...this.fixedMessages];
                    this.context = {
                        instructions: original.instructions,
                        messages: [...preservedMessages, compaction],
                    };
                    return {
                        status: "completed",
                        compaction,
                        preservedMessages,
                        usage: native.usage,
                        context: this.context,
                    };
                }
            } catch (error) {
                if (options.signal?.aborted) return { status: "cancelled", context: original };
                return {
                    status: "failed",
                    kind: "inference_error",
                    message: error instanceof Error ? error.message : String(error),
                    context: original,
                };
            }
        }
        let summary = "";
        let usage: SessionCacheUsage | undefined;
        let done: Extract<SessionEvent, { type: "done" }> | undefined;
        for await (const event of this.streamQuery({
            context: {
                instructions: original.instructions,
                messages: [...original.messages, { role: "user", content: prompt }],
            },
            model,
            tools: [],
            ...(this.activeEffort === undefined ? {} : { effort: this.activeEffort }),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
        })) {
            if (event.type === "text_delta") summary += event.delta;
            if (event.type === "token_usage") usage = event.usage;
            if (event.type === "done") done = event;
        }
        if (options.signal?.aborted) return { status: "cancelled", context: original };
        if (done?.state === "tool_call") {
            return {
                status: "failed",
                kind: "tool_call",
                message: "Claude attempted to call a tool while compacting.",
                context: original,
            };
        }
        if (done?.state === "error") {
            return {
                status: "failed",
                kind: "inference_error",
                message: done.message,
                context: original,
            };
        }
        if (summary.trim().length === 0) {
            return {
                status: "failed",
                kind: "invalid_summary",
                message: "Anthropic Bedrock returned an empty compaction summary.",
                context: original,
            };
        }
        usage = addSessionCacheUsage(nativeUsage, usage);
        const preservedMessages = [...this.fixedMessages];
        this.context = {
            instructions: original.instructions,
            messages: [
                ...preservedMessages,
                {
                    role: "user",
                    content: `<conversation_summary>\n${summary.trim()}\n</conversation_summary>`,
                },
            ],
        };
        return {
            status: "completed",
            summary: summary.trim(),
            preservedMessages,
            ...(usage === undefined ? {} : { usage }),
            context: this.context,
        };
    }

    destroy(): void {
        this.client = undefined;
    }

    private async *streamRun(request: SessionRunRequest): AsyncGenerator<SessionEvent> {
        const model = request.model ?? this.activeModel ?? this.model;
        if (model === undefined) {
            throw new Error("A model is required for Anthropic Bedrock inference.");
        }
        this.activeModel = model;
        const effort = request.effort ?? this.activeEffort;
        this.activeEffort = effort;
        const rebuiltMessages = withInitialSessionMessages(
            this.fixedMessages,
            request.context.messages,
        );
        this.context = {
            instructions: this.context.instructions,
            messages: restoreAnthropicBedrockCompaction(this.context.messages, rebuiltMessages),
        };
        let assistantText = "";
        let encryptedReasoning: string | undefined;
        let responseItems: readonly string[] | undefined;
        const toolCalls = new Map<string, SessionToolCall>();
        for await (const event of this.streamQuery({
            context: this.context,
            model,
            ...(effort === undefined ? {} : { effort }),
            ...(request.abort === undefined ? {} : { signal: request.abort }),
        })) {
            if (event.type === "text_delta") assistantText += event.delta;
            if (event.type === "encrypted_reasoning") encryptedReasoning = event.content;
            if (event.type === "response_items") responseItems = event.items;
            if (event.type === "tool_call_start") {
                toolCalls.set(event.callId, {
                    callId: event.callId,
                    name: event.name,
                    arguments: "",
                    vendor: event.vendor,
                });
            }
            if (event.type === "tool_call_delta") {
                const call = toolCalls.get(event.callId);
                if (call !== undefined) {
                    toolCalls.set(event.callId, {
                        ...call,
                        arguments: call.arguments + event.delta,
                    });
                }
            }
            if (event.type === "tool_call_end") {
                const call = toolCalls.get(event.callId);
                if (call !== undefined) {
                    toolCalls.set(event.callId, { ...call, arguments: event.arguments });
                }
            }
            if (event.type === "done" && event.state !== "error" && event.state !== "cancelled") {
                this.context = {
                    instructions: this.context.instructions,
                    messages: [
                        ...this.context.messages,
                        {
                            role: "assistant",
                            content: assistantText,
                            ...(encryptedReasoning === undefined ? {} : { encryptedReasoning }),
                            ...(responseItems === undefined ? {} : { responseItems }),
                            ...(toolCalls.size === 0 ? {} : { toolCalls: [...toolCalls.values()] }),
                        },
                    ],
                };
            }
            yield event;
        }
    }

    private async *streamQuery(options: {
        context: SessionContext;
        effort?: SessionReasoningEffort;
        model: string;
        signal?: AbortSignal;
        tools?: readonly SessionTool[];
    }): AsyncGenerator<SessionEvent> {
        let blockStarted = false;
        try {
            const tools = this.resolveTools(options.model, options.tools);
            const request = this.createRequest({ ...options, tools });
            let failedAttempts = 0;
            while (true) {
                let responseContentStarted = false;
                try {
                    const response = await this.resolveClient().beta.messages.create(
                        request,
                        options.signal === undefined ? undefined : { signal: options.signal },
                    );
                    for await (const event of mapAnthropicBedrockStream(response, { tools })) {
                        if (event.type === "block_start") blockStarted = true;
                        if (isAnthropicResponseContentEvent(event)) {
                            responseContentStarted = true;
                        }
                        yield event;
                    }
                    return;
                } catch (error) {
                    if (responseContentStarted) throw error;
                    failedAttempts += 1;
                    if (!shouldRetryAnthropicBedrock(error, failedAttempts)) throw error;
                    if (blockStarted) {
                        yield { type: "block_reset" };
                        blockStarted = false;
                    }
                    const delay = resolveAnthropicBedrockRetryDelay(error, failedAttempts);
                    yield {
                        type: "retrying",
                        attempt: failedAttempts,
                        reason: describeAnthropicBedrockRetry(error, failedAttempts, delay),
                    };
                    await waitForAnthropicBedrockRetry(delay, options.signal);
                }
            }
        } catch (error) {
            if (!blockStarted) yield { type: "block_start" };
            if (options.signal?.aborted) {
                yield { type: "block_reset" };
                yield { type: "done", state: "cancelled" };
                return;
            }
            yield { type: "block_reset" };
            yield {
                type: "done",
                state: "error",
                kind: classifyAnthropicBedrockError(error),
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private resolveClient(): AnthropicBedrockClient {
        return (this.client ??= createAnthropicBedrockClient({
            bearerToken: this.credential.credential.bearerToken,
            ...(this.endpoint === undefined ? {} : { endpoint: this.endpoint }),
            region: this.region,
            transport: this.transport,
        }));
    }

    private createRequest(options: {
        compactionInstructions?: string;
        context: SessionContext;
        effort?: SessionReasoningEffort;
        model: string;
        tools?: readonly SessionTool[];
    }) {
        const modelConfiguration = this.modelConfigurations?.[options.model];
        const skills = modelConfiguration?.skills ?? this.skills ?? [];
        const tools = this.resolveTools(options.model, options.tools);
        const context =
            modelConfiguration === undefined
                ? options.context
                : {
                      instructions: modelConfiguration.context.instructions,
                      messages: withInitialSessionMessages(
                          modelConfiguration.context.messages.filter(
                              (message) => message.role === "system",
                          ),
                          options.context.messages,
                      ),
                  };
        return createAnthropicBedrockRequest({
            context,
            model: resolveAnthropicBedrockModelId(options.model, this.region, this.transport),
            skills,
            tools,
            ...(options.compactionInstructions === undefined
                ? {}
                : { compaction: { instructions: options.compactionInstructions } }),
            ...(options.effort === undefined ? {} : { effort: options.effort }),
        });
    }

    private resolveTools(
        model: string,
        tools: readonly SessionTool[] | undefined,
    ): readonly SessionTool[] {
        return (
            tools ??
            this.modelConfigurations?.[model]?.tools ??
            this.tools ??
            resolveClaudeTools(model)
        );
    }
}

function emptyStream(): SessionStream {
    async function* stream(): AsyncGenerator<SessionEvent> {}
    return stream();
}

function isAnthropicResponseContentEvent(event: SessionEvent): boolean {
    return (
        event.type === "text_delta" ||
        event.type === "reasoning_delta" ||
        event.type === "tool_call_start" ||
        event.type === "tool_call_delta" ||
        event.type === "tool_call_end"
    );
}
