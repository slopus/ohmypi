import type { ContentBlock } from "../agent/types.js";
import type { CodexMcpToolCall } from "./CodexMcpToolCall.js";

export function formatCodexMcpToolResult(
    blocks: readonly ContentBlock[] | undefined,
): CodexMcpToolCall["result"] {
    if (blocks === undefined) return undefined;
    const results = blocks.map((block) =>
        block.type === "text"
            ? block.text.length === 0
                ? "(empty result)"
                : block.text
            : `Image result (${block.mediaType}).`,
    );
    if (results.length === 0) return undefined;
    return results.length === 1 ? results[0] : results;
}
