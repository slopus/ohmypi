import { extractGeminiGeneratedMedia } from "./extractGeminiGeneratedMedia.js";
import { requestGeminiInteraction } from "./requestGeminiInteraction.js";
import type { GeminiGeneratedMedia } from "./types.js";

const MUSIC_RESPONSE_LIMIT_BYTES = 64 * 1024 * 1024;
const MUSIC_TIMEOUT_MS = 5 * 60 * 1000;

export interface GenerateGeminiMusicOptions {
    apiKey: string;
    fetch?: typeof fetch;
    mode: "clip" | "song";
    prompt: string;
    signal?: AbortSignal;
}

export async function generateGeminiMusic(
    options: GenerateGeminiMusicOptions,
): Promise<GeminiGeneratedMedia> {
    const response = await requestGeminiInteraction({
        apiKey: options.apiKey,
        body: {
            input: options.prompt,
            model: options.mode === "song" ? "lyria-3-pro-preview" : "lyria-3-clip-preview",
        },
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        maximumResponseBytes: MUSIC_RESPONSE_LIMIT_BYTES,
        operation: "music generation",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        timeoutMs: MUSIC_TIMEOUT_MS,
    });
    return extractGeminiGeneratedMedia(response, "audio");
}
