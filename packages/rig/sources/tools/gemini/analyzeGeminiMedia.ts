import { extractGeminiText } from "./extractGeminiText.js";
import { requestGeminiInteraction } from "./requestGeminiInteraction.js";
import type { GeminiMediaInputType } from "./types.js";

const ANALYSIS_RESPONSE_LIMIT_BYTES = 4 * 1024 * 1024;
const ANALYSIS_TIMEOUT_MS = 2 * 60 * 1000;

export interface AnalyzeGeminiMediaOptions {
    apiKey: string;
    bytes: Uint8Array;
    fetch?: typeof fetch;
    mimeType: string;
    prompt: string;
    signal?: AbortSignal;
    type: GeminiMediaInputType;
}

export async function analyzeGeminiMedia(options: AnalyzeGeminiMediaOptions): Promise<string> {
    const response = await requestGeminiInteraction({
        apiKey: options.apiKey,
        body: {
            input: [
                {
                    data: Buffer.from(options.bytes).toString("base64"),
                    mime_type: options.mimeType,
                    type: options.type,
                },
                { text: options.prompt, type: "text" },
            ],
            model: "gemini-3.5-flash",
        },
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        maximumResponseBytes: ANALYSIS_RESPONSE_LIMIT_BYTES,
        operation: "media analysis",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        timeoutMs: ANALYSIS_TIMEOUT_MS,
    });
    return extractGeminiText(response);
}
