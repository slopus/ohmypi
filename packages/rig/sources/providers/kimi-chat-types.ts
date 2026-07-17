export interface KimiChatImagePart {
    image_url: { detail?: "high" | "original"; url: string };
    type: "image_url";
}

export interface KimiChatTextPart {
    text: string;
    type: "text";
}

export interface KimiChatToolCall {
    function: { arguments: string; name: string };
    id: string;
    type: "function";
}

export interface KimiChatMessage {
    content?: string | readonly (KimiChatImagePart | KimiChatTextPart)[];
    reasoning_content?: string;
    role: "assistant" | "system" | "tool" | "user";
    tool_call_id?: string;
    tool_calls?: readonly KimiChatToolCall[];
}

export interface KimiChatTool {
    function: {
        description: string;
        name: string;
        parameters: Record<string, unknown>;
    };
    type: "function";
}

export interface KimiChatRequest {
    max_completion_tokens: number;
    messages: readonly KimiChatMessage[];
    model: string;
    prompt_cache_key?: string;
    stream: true;
    stream_options: { include_usage: true };
    thinking: { effort: "max"; keep: "all"; type: "enabled" };
    tools?: readonly KimiChatTool[];
}

export interface KimiChatCompletionChunk {
    choices?: readonly {
        delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: readonly {
                function?: { arguments?: string | null; name?: string | null };
                id?: string | null;
                index?: number;
                type?: string;
            }[];
        };
        finish_reason?: string | null;
        usage?: KimiChatUsage | null;
    }[];
    id?: string;
    model?: string;
    usage?: KimiChatUsage | null;
}

export interface KimiChatUsage {
    cached_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
    prompt_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    total_tokens?: number;
}

export interface KimiChatClient {
    chat: {
        completions: {
            create(
                request: KimiChatRequest,
                options?: { signal?: AbortSignal },
            ): Promise<AsyncIterable<KimiChatCompletionChunk>>;
        };
    };
}
