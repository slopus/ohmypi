import type { Message } from "./types.js";

export function findFirstUserRequestText(messages: readonly Message[]): string | undefined {
    for (const message of messages) {
        if (message.role !== "user") continue;
        const text = message.blocks
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim();
        if (text.length > 0) return text;
    }
    return undefined;
}
