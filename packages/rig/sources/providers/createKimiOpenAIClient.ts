import OpenAI from "openai";

import type { KimiChatClient } from "./kimi-chat-types.js";

export function createKimiOpenAIClient(options: {
    baseUrl: string;
    headers: Record<string, string>;
    token: string;
}): KimiChatClient {
    return new OpenAI({
        apiKey: options.token,
        baseURL: options.baseUrl,
        defaultHeaders: options.headers,
    }) as unknown as KimiChatClient;
}
