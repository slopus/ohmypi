import { extractGeminiGeneratedMedia } from "./extractGeminiGeneratedMedia.js";
import { requestGeminiInteraction } from "./requestGeminiInteraction.js";
import type { GeminiGeneratedMedia } from "./types.js";

const IMAGE_RESPONSE_LIMIT_BYTES = 64 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 2 * 60 * 1000;

export interface GenerateGeminiImageOptions {
    apiKey: string;
    aspectRatio?: string;
    fetch?: typeof fetch;
    imageSize?: string;
    prompt: string;
    signal?: AbortSignal;
}

export async function generateGeminiImage(
    options: GenerateGeminiImageOptions,
): Promise<GeminiGeneratedMedia> {
    const response = await requestGeminiInteraction({
        apiKey: options.apiKey,
        body: {
            input: options.prompt,
            model: "gemini-3.1-flash-image",
            response_format: {
                type: "image",
                mime_type: "image/png",
                ...(options.aspectRatio === undefined ? {} : { aspect_ratio: options.aspectRatio }),
                ...(options.imageSize === undefined ? {} : { image_size: options.imageSize }),
            },
        },
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        maximumResponseBytes: IMAGE_RESPONSE_LIMIT_BYTES,
        operation: "image generation",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        timeoutMs: IMAGE_TIMEOUT_MS,
    });
    return extractGeminiGeneratedMedia(response, "image");
}
