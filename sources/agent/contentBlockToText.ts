import type { ContentBlock } from "./types.js";

export function contentBlockToText(block: ContentBlock): string {
    if (block.type === "text") {
        return block.text;
    }

    return `[image:${block.mediaType}]`;
}
