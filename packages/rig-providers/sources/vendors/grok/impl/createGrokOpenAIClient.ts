import OpenAI from "openai";

export type GrokOpenAIClient = Pick<OpenAI, "responses">;

export function createGrokOpenAIClient(options: {
    baseUrl: string;
    token: string;
}): GrokOpenAIClient {
    return new OpenAI({
        apiKey: options.token,
        baseURL: options.baseUrl,
        maxRetries: 0,
    });
}
