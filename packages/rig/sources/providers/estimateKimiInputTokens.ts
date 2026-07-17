import type { Context } from "./types.js";

// Base64 image data dwarfs real vision token cost, so payloads are replaced
// with a fixed per-image estimate instead of being measured as text.
const ESTIMATED_IMAGE_TOKENS = 2_048;

export function estimateKimiInputTokens(context: Context): number {
    let images = 0;
    const serialized = JSON.stringify(
        {
            messages: context.messages,
            systemPrompt: context.systemPrompt,
            tools: context.tools,
        },
        (_key, value: unknown) => {
            if (isImageBlock(value)) {
                images += 1;
                return { ...value, data: "" };
            }
            return value;
        },
    );
    return Math.ceil(serialized.length / 4) + images * ESTIMATED_IMAGE_TOKENS;
}

function isImageBlock(value: unknown): value is { data: string; type: "image" } {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as { type?: unknown }).type === "image" &&
        typeof (value as { data?: unknown }).data === "string"
    );
}
