import {
    createSdkMcpServer,
    query as defaultClaudeSdkQuery,
    tool as defineSdkTool,
    type EffortLevel,
    type Options as ClaudeSdkOptions,
    type SDKResultMessage,
    type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { z, type ZodTypeAny } from "zod/v4";

import type { AgentContext, AnyDefinedTool, ContentBlock } from "../agent/index.js";
import { claudeCodeTools } from "../tools/claude/index.js";
import {
    modelAnthropicFable5,
    modelAnthropicHaiku45,
    modelAnthropicOpus46,
    modelAnthropicOpus47,
    modelAnthropicOpus48,
    modelAnthropicSonnet5,
    modelAnthropicSonnet46,
    modelAnthropicSonnet461m,
} from "./models.js";
import {
    defineProvider,
    type AssistantMessage,
    type AssistantMessageEvent,
    type Context,
    type InferenceStream,
    type Model,
    type StopReason,
    type StreamOptions,
    type Usage,
    type UserMessage,
} from "./types.js";

const CLAUDE_SDK_PROVIDER_ID = "claude-sdk";
const OHMYPI_MCP_SERVER_NAME = "ohmypi";
const CLAUDE_SDK_API_NAME = "claude-agent-sdk";

export type ClaudeSdkQuery = typeof defaultClaudeSdkQuery;

export interface ClaudeSdkProviderOptions {
    agentContext: AgentContext;
    tools?: readonly AnyDefinedTool[];
    query?: ClaudeSdkQuery;
    now?: () => number;
}

export function createClaudeSdkProvider(options: ClaudeSdkProviderOptions) {
    const query = options.query ?? defaultClaudeSdkQuery;
    const tools = options.tools ?? claudeCodeTools;
    const now = options.now ?? Date.now;

    return defineProvider({
        id: CLAUDE_SDK_PROVIDER_ID,
        models: [
            modelAnthropicFable5,
            modelAnthropicOpus48,
            modelAnthropicSonnet5,
            modelAnthropicOpus47,
            modelAnthropicOpus46,
            modelAnthropicSonnet461m,
            modelAnthropicSonnet46,
            modelAnthropicHaiku45,
        ],
        stream(model, context, streamOptions) {
            const activeTools = toolsForProviderContext(tools, context);
            const sdkOptions = toClaudeSdkOptions({
                agentContext: options.agentContext,
                context,
                model,
                streamOptions,
                tools: activeTools,
            });
            const prompt = toClaudeSdkPrompt(context);

            const run = async function* (): AsyncGenerator<
                AssistantMessageEvent,
                AssistantMessage
            > {
                const partial = createAssistantMessage({
                    model,
                    now,
                    stopReason: "stop",
                });
                yield { type: "start", partial };

                try {
                    const sdkStream = query({ prompt, options: sdkOptions });
                    let result: SDKResultMessage | undefined;

                    for await (const message of sdkStream) {
                        if (message.type === "result") {
                            result = message;
                        }
                    }

                    if (result === undefined) {
                        const error = createErrorAssistantMessage({
                            model,
                            now,
                            errorMessage: "Claude SDK finished without returning a result.",
                        });
                        yield { type: "error", reason: "error", error };
                        return error;
                    }

                    if (result.subtype !== "success") {
                        const error = createErrorAssistantMessage({
                            model,
                            now,
                            errorMessage: sdkResultErrorMessage(result),
                            responseId: result.uuid,
                            usage: usageFromClaudeSdkResult(result),
                        });
                        yield { type: "error", reason: "error", error };
                        return error;
                    }

                    const content = result.result;
                    const assistantOptions: Parameters<typeof createAssistantMessage>[0] = {
                        model,
                        now,
                        responseId: result.uuid,
                        stopReason: stopReasonFromClaudeSdkResult(result),
                        text: content,
                        usage: usageFromClaudeSdkResult(result),
                    };
                    const responseModel = responseModelFromResult(result);
                    if (responseModel !== undefined) {
                        assistantOptions.responseModel = responseModel;
                    }
                    const message = createAssistantMessage(assistantOptions);

                    if (content.length > 0) {
                        yield { type: "text_start", contentIndex: 0, partial };
                        yield {
                            type: "text_delta",
                            contentIndex: 0,
                            delta: content,
                            partial: message,
                        };
                        yield {
                            type: "text_end",
                            contentIndex: 0,
                            content,
                            partial: message,
                        };
                    }

                    yield { type: "done", reason: assistantOptions.stopReason, message };
                    return message;
                } catch (error) {
                    const isAborted = streamOptions?.signal?.aborted === true;
                    const assistantMessage = createErrorAssistantMessage({
                        model,
                        now,
                        errorMessage: errorToMessage(error),
                        stopReason: isAborted ? "aborted" : "error",
                    });
                    yield {
                        type: "error",
                        reason: isAborted ? "aborted" : "error",
                        error: assistantMessage,
                    };
                    return assistantMessage;
                }
            };

            return createInferenceStream(run);
        },
    });
}

function toolsForProviderContext(
    tools: readonly AnyDefinedTool[],
    context: Context,
): readonly AnyDefinedTool[] {
    if (context.tools === undefined) {
        return tools;
    }

    const selectedToolNames = new Set(context.tools.map((tool) => tool.name));
    return tools.filter((tool) => selectedToolNames.has(tool.name));
}

function toClaudeSdkOptions(options: {
    agentContext: AgentContext;
    context: Context;
    model: Model;
    streamOptions: StreamOptions | undefined;
    tools: readonly AnyDefinedTool[];
}): ClaudeSdkOptions {
    const abortController = toAbortController(options.streamOptions?.signal);
    const mcpTools = options.tools.map((sourceTool) =>
        toClaudeSdkTool(sourceTool, options.agentContext, options.streamOptions?.signal),
    );
    const mcpToolNames = options.tools.map(
        (sourceTool) => `mcp__${OHMYPI_MCP_SERVER_NAME}__${sourceTool.name}`,
    );
    const sdkOptions: ClaudeSdkOptions = {
        // Claude Code permission matching still uses the MCP identity even when
        // the model-visible tool name is unprefixed.
        allowedTools: mcpToolNames,
        cwd: options.agentContext.fs.cwd,
        mcpServers: {
            [OHMYPI_MCP_SERVER_NAME]: createSdkMcpServer({
                name: OHMYPI_MCP_SERVER_NAME,
                instructions:
                    "Use these ohmypi project tools for filesystem, shell, search, and editing work. Claude Code built-in tools are disabled for this session.",
                tools: mcpTools,
                alwaysLoad: true,
            }),
        },
        model: toClaudeSdkModelId(options.model.id),
        env: {
            ...process.env,
            CLAUDE_CODE_DISABLE_BUNDLED_SKILLS: "1",
            CLAUDE_AGENT_SDK_MCP_NO_PREFIX: "1",
        },
        extraArgs: {
            "disable-slash-commands": null,
        },
        permissionMode: "dontAsk",
        persistSession: false,
        settingSources: [],
        skills: [],
        strictMcpConfig: true,
        systemPrompt: options.context.systemPrompt ?? "",
        tools: [],
    };

    if (abortController !== undefined) {
        sdkOptions.abortController = abortController;
    }
    const thinkingOptions = toClaudeSdkThinkingOptions(options.streamOptions?.thinking);
    if (thinkingOptions !== undefined) {
        Object.assign(sdkOptions, thinkingOptions);
    }

    return sdkOptions;
}

function toClaudeSdkTool(
    sourceTool: AnyDefinedTool,
    context: AgentContext,
    signal: AbortSignal | undefined,
) {
    return defineSdkTool(
        sourceTool.name,
        sourceTool.description,
        toZodRawShape(sourceTool.arguments),
        async (args): Promise<CallToolResult> => {
            if (!Value.Check(sourceTool.arguments, args)) {
                return textToolResult(`Invalid arguments for tool '${sourceTool.name}'.`, true);
            }

            try {
                const executionOptions = signal === undefined ? {} : { signal };
                const result = await sourceTool.execute(args as never, context, executionOptions);
                return {
                    content: sourceTool.toLLM(result as never).map(toMcpContent),
                };
            } catch (error) {
                return textToolResult(
                    `Tool '${sourceTool.name}' failed: ${errorToMessage(error)}`,
                    true,
                );
            }
        },
        { alwaysLoad: true },
    );
}

function toZodRawShape(schema: TSchema): Record<string, ZodTypeAny> {
    const objectSchema = schema as TSchema & {
        properties?: Record<string, TSchema>;
        required?: string[];
    };
    const properties = objectSchema.properties ?? {};
    const required = new Set(objectSchema.required ?? []);

    return Object.fromEntries(
        Object.entries(properties).map(([key, property]) => {
            const propertySchema = required.has(key)
                ? toZodSchema(property)
                : toZodSchema(property).optional();
            return [key, propertySchema];
        }),
    );
}

function toZodSchema(schema: TSchema): ZodTypeAny {
    const jsonSchema = schema as TSchema & {
        anyOf?: TSchema[];
        const?: unknown;
        description?: string;
        enum?: unknown[];
        items?: TSchema;
        properties?: Record<string, TSchema>;
        required?: string[];
        type?: string;
    };

    let zodSchema: ZodTypeAny;
    if (Object.prototype.hasOwnProperty.call(jsonSchema, "const")) {
        zodSchema = z.literal(toZodLiteralValue(jsonSchema.const));
    } else if (Array.isArray(jsonSchema.enum) && jsonSchema.enum.length > 0) {
        const literals = jsonSchema.enum.map((value) => z.literal(toZodLiteralValue(value)));
        zodSchema = unionZodSchemas(literals);
    } else if (Array.isArray(jsonSchema.anyOf)) {
        zodSchema = unionZodSchemas(jsonSchema.anyOf.map(toZodSchema));
    } else if (jsonSchema.type === "string") {
        zodSchema = z.string();
    } else if (jsonSchema.type === "number" || jsonSchema.type === "integer") {
        zodSchema = z.number();
    } else if (jsonSchema.type === "boolean") {
        zodSchema = z.boolean();
    } else if (jsonSchema.type === "array") {
        zodSchema = z.array(
            jsonSchema.items === undefined ? z.unknown() : toZodSchema(jsonSchema.items),
        );
    } else if (jsonSchema.type === "object") {
        zodSchema = z.object(toZodRawShape(schema));
    } else {
        zodSchema = z.unknown();
    }

    return jsonSchema.description === undefined
        ? zodSchema
        : zodSchema.describe(jsonSchema.description);
}

function unionZodSchemas(schemas: ZodTypeAny[]): ZodTypeAny {
    if (schemas.length === 0) {
        return z.unknown();
    }
    if (schemas.length === 1) {
        return schemas[0] ?? z.unknown();
    }

    return z.union(schemas as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
}

function toZodLiteralValue(value: unknown): string | number | boolean | null {
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
    ) {
        return value;
    }

    return String(value);
}

function toMcpContent(block: ContentBlock): CallToolResult["content"][number] {
    if (block.type === "text") {
        return {
            type: "text",
            text: block.text,
        };
    }

    return {
        type: "image",
        data: block.data,
        mimeType: block.mediaType,
    };
}

function textToolResult(text: string, isError: boolean): CallToolResult {
    return {
        content: [{ type: "text", text }],
        isError,
    };
}

function toClaudeSdkPrompt(context: Context): string | AsyncIterable<SDKUserMessage> {
    const latestUserMessage = [...context.messages].reverse().find(isUserMessage);
    if (latestUserMessage === undefined) {
        return "";
    }

    if (context.messages.length <= 1) {
        return singleMessagePrompt(toClaudeSdkUserMessage(latestUserMessage));
    }

    return serializeProviderTranscript(context.messages);
}

async function* singleMessagePrompt(message: SDKUserMessage): AsyncIterable<SDKUserMessage> {
    yield message;
}

function toClaudeSdkUserMessage(message: UserMessage): SDKUserMessage {
    return {
        type: "user",
        parent_tool_use_id: null,
        message: {
            role: "user",
            content:
                typeof message.content === "string"
                    ? message.content
                    : message.content.map((content) =>
                          content.type === "text"
                              ? { type: "text" as const, text: content.text }
                              : {
                                    type: "image" as const,
                                    source: {
                                        type: "base64" as const,
                                        media_type: content.mimeType as "image/jpeg",
                                        data: content.data,
                                    },
                                },
                      ),
        },
        timestamp: new Date(message.timestamp).toISOString(),
    };
}

function serializeProviderTranscript(messages: readonly Context["messages"][number][]): string {
    const lines = [
        "Continue the conversation below. Treat it as prior transcript context and answer the latest user message.",
        "",
    ];

    for (const message of messages) {
        if (message.role === "user") {
            lines.push(`User: ${userContentToText(message.content)}`);
        } else if (message.role === "assistant") {
            lines.push(
                `Assistant: ${message.content
                    .map((content) => {
                        if (content.type === "text") return content.text;
                        if (content.type === "thinking") return "[thinking omitted]";
                        return `[tool call: ${content.name}]`;
                    })
                    .join("")}`,
            );
        } else {
            lines.push(
                `Tool result from ${message.toolName}: ${message.content
                    .map((content) =>
                        content.type === "text" ? content.text : `[image: ${content.mimeType}]`,
                    )
                    .join("")}`,
            );
        }
    }

    return lines.join("\n");
}

function userContentToText(content: UserMessage["content"]): string {
    if (typeof content === "string") {
        return content;
    }

    return content
        .map((block) => (block.type === "text" ? block.text : `[image: ${block.mimeType}]`))
        .join("");
}

function isUserMessage(message: Context["messages"][number]): message is UserMessage {
    return message.role === "user";
}

function toAbortController(signal: AbortSignal | undefined): AbortController | undefined {
    if (signal === undefined) {
        return undefined;
    }

    const controller = new AbortController();
    if (signal.aborted) {
        controller.abort(signal.reason);
    } else {
        signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    return controller;
}

function toClaudeSdkThinkingOptions(
    thinking: string | undefined,
): Pick<ClaudeSdkOptions, "effort" | "thinking"> | undefined {
    if (thinking === undefined) {
        return undefined;
    }
    if (thinking === "off") {
        return { thinking: { type: "disabled" } };
    }
    if (isClaudeSdkEffortLevel(thinking)) {
        return {
            effort: thinking,
            thinking: { type: "adaptive" },
        };
    }

    return undefined;
}

function isClaudeSdkEffortLevel(thinking: string): thinking is EffortLevel {
    return (
        thinking === "low" ||
        thinking === "medium" ||
        thinking === "high" ||
        thinking === "xhigh" ||
        thinking === "max"
    );
}

function toClaudeSdkModelId(modelId: string): string {
    if (modelId === "anthropic/fable-5") return "claude-fable-5[1m]";
    if (modelId === "anthropic/opus-4-8") return "opus[1m]";
    if (modelId === "anthropic/sonnet-5") return "sonnet";
    return modelId.startsWith("anthropic/")
        ? `claude-${modelId.slice("anthropic/".length)}`
        : modelId;
}

function createInferenceStream(
    run: () => AsyncGenerator<AssistantMessageEvent, AssistantMessage>,
): InferenceStream {
    let resultResolve: (message: AssistantMessage) => void;
    let resultReject: (error: unknown) => void;
    const resultPromise = new Promise<AssistantMessage>((resolve, reject) => {
        resultResolve = resolve;
        resultReject = reject;
    });
    let started = false;

    const drain = async () => {
        try {
            const generator = run();
            let next = await generator.next();
            while (!next.done) {
                next = await generator.next();
            }
            resultResolve(next.value);
        } catch (error) {
            resultReject(error);
        }
    };

    return {
        async *[Symbol.asyncIterator]() {
            if (started) {
                throw new Error("Claude SDK inference streams can only be consumed once.");
            }
            started = true;

            try {
                const result = yield* run();
                resultResolve(result);
            } catch (error) {
                resultReject(error);
                throw error;
            }
        },
        result: async () => {
            if (!started) {
                started = true;
                void drain();
            }

            return resultPromise;
        },
    };
}

function createAssistantMessage(options: {
    model: Model;
    now: () => number;
    responseId?: string;
    responseModel?: string;
    stopReason: Extract<StopReason, "stop" | "length">;
    text?: string;
    usage?: Usage;
}): AssistantMessage {
    return {
        role: "assistant",
        api: CLAUDE_SDK_API_NAME,
        provider: CLAUDE_SDK_PROVIDER_ID,
        model: options.model.id,
        content:
            options.text === undefined || options.text.length === 0
                ? []
                : [{ type: "text", text: options.text }],
        usage: options.usage ?? zeroUsage(),
        stopReason: options.stopReason,
        timestamp: options.now(),
        ...(options.responseId !== undefined ? { responseId: options.responseId } : {}),
        ...(options.responseModel !== undefined ? { responseModel: options.responseModel } : {}),
    };
}

function createErrorAssistantMessage(options: {
    model: Model;
    now: () => number;
    errorMessage: string;
    responseId?: string;
    stopReason?: Extract<StopReason, "aborted" | "error">;
    usage?: Usage;
}): AssistantMessage {
    return {
        role: "assistant",
        api: CLAUDE_SDK_API_NAME,
        provider: CLAUDE_SDK_PROVIDER_ID,
        model: options.model.id,
        content: [],
        usage: options.usage ?? zeroUsage(),
        stopReason: options.stopReason ?? "error",
        errorMessage: options.errorMessage,
        timestamp: options.now(),
        ...(options.responseId !== undefined ? { responseId: options.responseId } : {}),
    };
}

function stopReasonFromClaudeSdkResult(
    result: SDKResultMessage,
): Extract<StopReason, "stop" | "length"> {
    return result.stop_reason === "max_tokens" || result.terminal_reason === "max_turns"
        ? "length"
        : "stop";
}

function usageFromClaudeSdkResult(result: SDKResultMessage): Usage {
    const input = result.usage.input_tokens;
    const output = result.usage.output_tokens;
    const cacheRead = result.usage.cache_read_input_tokens;
    const cacheWrite = result.usage.cache_creation_input_tokens;

    return {
        input,
        output,
        cacheRead,
        cacheWrite,
        totalTokens: input + output + cacheRead + cacheWrite,
        cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: result.total_cost_usd,
        },
    };
}

function responseModelFromResult(result: SDKResultMessage): string | undefined {
    const models = Object.keys(result.modelUsage);
    return models.length === 0 ? undefined : models[0];
}

function sdkResultErrorMessage(result: SDKResultMessage): string {
    if (result.subtype === "success") {
        return "";
    }

    return result.errors.length > 0 ? result.errors.join("\n") : result.subtype;
}

function zeroUsage(): Usage {
    return {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
        },
    };
}

function errorToMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
