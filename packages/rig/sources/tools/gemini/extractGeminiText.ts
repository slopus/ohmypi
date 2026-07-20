interface GeminiTextBlock {
    text?: string;
    type?: string;
}

interface GeminiTextResponse {
    steps?: readonly {
        content?: readonly GeminiTextBlock[];
        type?: string;
    }[];
}

export function extractGeminiText(response: unknown): string {
    const interaction =
        typeof response === "object" && response !== null ? (response as GeminiTextResponse) : {};
    const text: string[] = [];
    for (const step of interaction.steps ?? []) {
        if (step.type !== "model_output") continue;
        for (const block of step.content ?? []) {
            if (block.type === "text" && block.text?.trim()) text.push(block.text.trim());
        }
    }
    if (text.length === 0) throw new Error("Gemini media analysis returned no text response.");
    const result = truncateTextHead(text.join("\n\n"), {
        maxBytes: MAX_ANALYSIS_BYTES,
        maxLines: MAX_ANALYSIS_LINES,
    });
    return result.truncated ? `${result.content}\n\n[Gemini analysis truncated]` : result.content;
}
import { truncateTextHead } from "../utils/truncateTextHead.js";

const MAX_ANALYSIS_BYTES = 200 * 1024;
const MAX_ANALYSIS_LINES = 5_000;
