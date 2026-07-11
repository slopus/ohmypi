import type { ContentBlock } from "../agent/types.js";

export function mcpResultToContentBlocks(result: unknown): readonly ContentBlock[] {
    if (!isRecord(result)) return [{ type: "text", text: String(result) }];
    const blocks = Array.isArray(result.content)
        ? result.content.flatMap((content) => contentToBlocks(content))
        : [];
    if (blocks.length > 0) return blocks;
    if (result.structuredContent !== undefined) {
        return [{ type: "text", text: JSON.stringify(result.structuredContent) }];
    }
    return [{ type: "text", text: "The MCP tool completed without returning content." }];
}

function contentToBlocks(content: unknown): ContentBlock[] {
    if (!isRecord(content) || typeof content.type !== "string") return [];
    if (content.type === "text" && typeof content.text === "string") {
        return [{ type: "text", text: content.text }];
    }
    if (
        content.type === "image" &&
        typeof content.data === "string" &&
        typeof content.mimeType === "string"
    ) {
        return [{ type: "image", data: content.data, mediaType: content.mimeType }];
    }
    if (content.type === "resource" && isRecord(content.resource)) {
        if (typeof content.resource.text === "string") {
            return [{ type: "text", text: content.resource.text }];
        }
        return [
            {
                type: "text",
                text: `MCP resource: ${typeof content.resource.uri === "string" ? content.resource.uri : "embedded content"}`,
            },
        ];
    }
    if (content.type === "resource_link") {
        return [
            {
                type: "text",
                text: `MCP resource: ${typeof content.uri === "string" ? content.uri : "linked content"}`,
            },
        ];
    }
    if (content.type === "audio") {
        return [{ type: "text", text: "The MCP tool returned audio content." }];
    }
    return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
