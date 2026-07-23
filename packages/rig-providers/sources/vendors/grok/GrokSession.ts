import { BaseSession } from "@/core/BaseSession.js";
import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionEvent, SessionStream } from "@/core/SessionEvent.js";
import { isSessionErrorDone } from "@/core/SessionEvent.js";
import type { SessionRunRequest } from "@/core/SessionRunRequest.js";
import type { SessionOptions } from "@/core/SessionOptions.js";
import { withInitialSessionMessages } from "@/core/withInitialSessionMessages.js";
import type { GrokCredential } from "@/vendors/VendorCredential.js";
import { GROK_INFERENCE_MAX_RETRIES } from "@/vendors/grok/impl/grokConstants.js";
import {
    createGrokOpenAIClient,
    type GrokOpenAIClient,
} from "@/vendors/grok/impl/createGrokOpenAIClient.js";
import { createGrokOpenAIRequest } from "@/vendors/grok/impl/createGrokOpenAIRequest.js";
import { createGrokRequestHeaders } from "@/vendors/grok/impl/createGrokRequestHeaders.js";
import { classifyGrokError } from "@/vendors/grok/impl/classifyGrokError.js";
import { delayBeforeGrokRetry, isRetryableGrokError } from "@/vendors/grok/impl/grokRetry.js";
import { mapGrokResponseStream } from "@/vendors/grok/impl/mapGrokResponseStream.js";

const COMPACTION_PROMPT =
    "Provide a concise summary of the conversation so far. Output only the summary.";

export interface GrokSessionOptions extends SessionOptions {
    credential: GrokCredential;
    endpoint: string;
    model?: string;
}

export class GrokSession extends BaseSession {
    readonly credential: GrokCredential;
    readonly endpoint: string;
    readonly model: string | undefined;

    private client: GrokOpenAIClient | undefined;
    private context: SessionContext;
    private readonly initialMessages: SessionContext["messages"];

    constructor(id: string, options: GrokSessionOptions) {
        super(id);
        this.credential = options.credential;
        this.context = { ...options.context, messages: [...options.context.messages] };
        this.initialMessages = [...options.context.messages];
        this.endpoint = options.endpoint;
        this.model = options.model;
    }

    run(request: SessionRunRequest): SessionStream {
        if (request.abort?.aborted) {
            return emptySessionStream();
        }

        return this.streamRun(request);
    }

    async compact(signal?: AbortSignal): Promise<SessionContext> {
        const context = this.context;
        if (signal?.aborted) {
            return context;
        }

        const compactionContext: SessionContext = {
            instructions: context.instructions,
            messages: [
                ...context.messages.slice(this.initialMessages.length),
                { role: "user", content: COMPACTION_PROMPT },
            ],
        };

        let summary = "";
        for await (const event of this.streamRun({
            context: compactionContext,
            ...(signal === undefined ? {} : { abort: signal }),
            ...(this.model === undefined ? {} : { model: this.model }),
        })) {
            if (signal?.aborted) {
                return context;
            }
            if (event.type === "text_delta") {
                summary += event.delta;
            }
            if (isSessionErrorDone(event)) {
                throw new Error(`[${event.kind}] ${event.message}`);
            }
        }

        const trimmed = summary.trim();
        if (trimmed.length === 0) {
            throw new Error("Compaction returned an empty summary.");
        }

        this.context = {
            instructions: context.instructions,
            messages: [
                {
                    role: "user",
                    content: `<conversation_summary>\n${trimmed}\n</conversation_summary>`,
                },
            ],
        };
        return this.context;
    }

    destroy(): void {
        this.client = undefined;
    }

    private async *streamRun(request: SessionRunRequest): AsyncGenerator<SessionEvent> {
        const { abort } = request;
        this.context = {
            instructions: this.context.instructions,
            messages: withInitialSessionMessages(this.initialMessages, request.context.messages),
        };
        const context = this.context;
        const model = request.model ?? this.model;
        if (model === undefined) throw new Error("A model is required for Grok inference.");
        const effort = request.effort;

        if (abort?.aborted) {
            return;
        }

        const client = await this.resolveClient();
        let attempt = 0;
        let responseContentBegun = false;

        for (;;) {
            if (abort?.aborted) {
                return;
            }

            try {
                const responseStream = await client.responses.create(
                    createGrokOpenAIRequest({
                        apiModelId: model,
                        context,
                        ...(effort === undefined ? {} : { effort }),
                    }),
                    {
                        headers: createGrokRequestHeaders({
                            baseUrl: this.endpoint,
                            model,
                            sessionId: this.id,
                            turnIndex: context.messages.filter(
                                (message) => message.role === "assistant",
                            ).length,
                        }),
                        ...(abort === undefined ? {} : { signal: abort }),
                    },
                );

                for await (const event of mapGrokResponseStream(responseStream, {
                    ...(abort === undefined ? {} : { signal: abort }),
                    failureMessage: `${model} failed to generate a response.`,
                })) {
                    if (
                        event.type === "text_delta" ||
                        event.type === "tool_call_delta" ||
                        event.type === "server_tool_call_delta"
                    ) {
                        responseContentBegun = true;
                    }

                    yield event;

                    if (event.type === "done") {
                        return;
                    }
                }

                return;
            } catch (error) {
                if (abort?.aborted) {
                    return;
                }

                const message = error instanceof Error ? error.message : String(error);
                if (
                    !responseContentBegun &&
                    attempt < GROK_INFERENCE_MAX_RETRIES &&
                    isRetryableGrokError(error)
                ) {
                    attempt += 1;
                    yield { type: "retrying", attempt, reason: message };
                    await delayBeforeGrokRetry(attempt, abort);
                    if (abort?.aborted) {
                        return;
                    }
                    continue;
                }

                yield {
                    type: "done",
                    state: "error",
                    kind: classifyGrokError(message),
                    message,
                };
                return;
            }
        }
    }

    private async resolveClient(): Promise<GrokOpenAIClient> {
        if (this.client !== undefined) {
            return this.client;
        }

        this.client = createGrokOpenAIClient({
            baseUrl: this.endpoint,
            token: this.credential.credential.token,
        });
        return this.client;
    }
}

function emptySessionStream(): SessionStream {
    async function* generator(): AsyncGenerator<SessionEvent> {}
    return generator();
}
