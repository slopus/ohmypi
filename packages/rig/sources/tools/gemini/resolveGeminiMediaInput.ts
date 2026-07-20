import { extname } from "node:path";

import type { GeminiMediaInput } from "./types.js";

const MEDIA_BY_EXTENSION: Readonly<Record<string, GeminiMediaInput>> = {
    ".aac": { mimeType: "audio/aac", type: "audio" },
    ".aif": { mimeType: "audio/aiff", type: "audio" },
    ".aiff": { mimeType: "audio/aiff", type: "audio" },
    ".avi": { mimeType: "video/x-msvideo", type: "video" },
    ".flac": { mimeType: "audio/flac", type: "audio" },
    ".gif": { mimeType: "image/gif", type: "image" },
    ".heic": { mimeType: "image/heic", type: "image" },
    ".heif": { mimeType: "image/heif", type: "image" },
    ".jpeg": { mimeType: "image/jpeg", type: "image" },
    ".jpg": { mimeType: "image/jpeg", type: "image" },
    ".mov": { mimeType: "video/quicktime", type: "video" },
    ".mp3": { mimeType: "audio/mp3", type: "audio" },
    ".mp4": { mimeType: "video/mp4", type: "video" },
    ".mpeg": { mimeType: "video/mpeg", type: "video" },
    ".mpg": { mimeType: "video/mpeg", type: "video" },
    ".ogg": { mimeType: "audio/ogg", type: "audio" },
    ".pdf": { mimeType: "application/pdf", type: "document" },
    ".png": { mimeType: "image/png", type: "image" },
    ".wav": { mimeType: "audio/wav", type: "audio" },
    ".webm": { mimeType: "video/webm", type: "video" },
    ".webp": { mimeType: "image/webp", type: "image" },
    ".wmv": { mimeType: "video/x-ms-wmv", type: "video" },
};

export function resolveGeminiMediaInput(path: string): GeminiMediaInput {
    const media = MEDIA_BY_EXTENSION[extname(path).toLowerCase()];
    if (media === undefined) {
        throw new Error(
            `Unsupported Gemini media file extension for '${path}'. Use an image, audio, video, or PDF file.`,
        );
    }
    return media;
}
