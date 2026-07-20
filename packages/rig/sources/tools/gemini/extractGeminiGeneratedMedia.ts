import { truncateTextHead } from "../utils/truncateTextHead.js";
import type { GeminiGeneratedMedia } from "./types.js";

const MAX_GENERATED_TEXT_BYTES = 100 * 1024;
const MAX_GENERATED_TEXT_LINES = 2_000;

interface GeminiContentBlock {
    data?: string;
    mime_type?: string;
    text?: string;
    type?: string;
}

interface GeminiInteractionResponse {
    steps?: readonly {
        content?: readonly GeminiContentBlock[];
        type?: string;
    }[];
}

export function extractGeminiGeneratedMedia(
    response: unknown,
    expectedType: "audio" | "image",
): GeminiGeneratedMedia {
    const interaction =
        typeof response === "object" && response !== null
            ? (response as GeminiInteractionResponse)
            : {};
    let media: GeminiContentBlock | undefined;
    const text: string[] = [];

    for (const step of interaction.steps ?? []) {
        if (step.type !== "model_output") continue;
        for (const block of step.content ?? []) {
            if (block.type === "text" && block.text?.trim()) text.push(block.text.trim());
            if (block.type === expectedType && block.data) media = block;
        }
    }

    if (media?.data === undefined) {
        throw new Error(`Gemini returned no generated ${expectedType}.`);
    }
    const bytes = Buffer.from(media.data, "base64");
    if (bytes.byteLength === 0) {
        throw new Error(`Gemini returned an empty generated ${expectedType}.`);
    }

    const combinedText = text.join("\n\n");
    const truncatedText = truncateTextHead(combinedText, {
        maxBytes: MAX_GENERATED_TEXT_BYTES,
        maxLines: MAX_GENERATED_TEXT_LINES,
    });
    return {
        bytes,
        mimeType: media.mime_type?.trim() || (expectedType === "image" ? "image/png" : "audio/mp3"),
        ...(text.length === 0
            ? {}
            : {
                  text: truncatedText.truncated
                      ? `${truncatedText.content}\n\n[Gemini text output truncated]`
                      : truncatedText.content,
              }),
    };
}
