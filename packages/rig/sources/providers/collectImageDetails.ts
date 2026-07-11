import type { Context } from "./types.js";

export function collectImageDetails(context: Context): Array<"high" | "original"> {
    const details: Array<"high" | "original"> = [];
    for (const message of context.messages) {
        if (message.role === "assistant" || typeof message.content === "string") {
            continue;
        }
        for (const content of message.content) {
            if (content.type === "image") {
                details.push(content.detail ?? "high");
            }
        }
    }
    return details;
}
