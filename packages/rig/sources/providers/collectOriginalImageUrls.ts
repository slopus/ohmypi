import type { Context } from "./types.js";

export function collectOriginalImageUrls(context: Context): Set<string> {
    const imageUrls = new Set<string>();
    for (const message of context.messages) {
        if (message.role === "assistant" || typeof message.content === "string") {
            continue;
        }
        for (const content of message.content) {
            if (content.type === "image" && content.detail === "original") {
                imageUrls.add(`data:${content.mimeType};base64,${content.data}`);
            }
        }
    }
    return imageUrls;
}
