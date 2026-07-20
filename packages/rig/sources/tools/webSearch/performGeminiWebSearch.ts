import type { WebSearchInput, WebSearchOutput } from "../claude/webSearch/types.js";
import { requestGeminiInteraction } from "../gemini/requestGeminiInteraction.js";
import { createGeminiSearchPrompt } from "./createGeminiSearchPrompt.js";
import { parseGeminiWebSearchResponse } from "./parseGeminiWebSearchResponse.js";

const GEMINI_SEARCH_MODEL = "gemini-3.5-flash";
const GEMINI_SEARCH_TIMEOUT_MS = 30_000;
const MAX_GEMINI_RESPONSE_BYTES = 2_000_000;

export interface PerformGeminiWebSearchOptions {
    apiKey: string;
    fetch?: typeof fetch;
    signal?: AbortSignal;
}

export async function performGeminiWebSearch(
    input: WebSearchInput,
    options: PerformGeminiWebSearchOptions,
): Promise<WebSearchOutput> {
    const startedAt = performance.now();
    const payload = await requestGeminiInteraction({
        apiKey: options.apiKey,
        body: {
            input: createGeminiSearchPrompt(input),
            model: GEMINI_SEARCH_MODEL,
            tools: [{ type: "google_search" }],
        },
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        maximumResponseBytes: MAX_GEMINI_RESPONSE_BYTES,
        operation: "web search",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        timeoutMs: GEMINI_SEARCH_TIMEOUT_MS,
    });
    return parseGeminiWebSearchResponse(
        payload,
        input.query,
        (performance.now() - startedAt) / 1000,
    );
}
