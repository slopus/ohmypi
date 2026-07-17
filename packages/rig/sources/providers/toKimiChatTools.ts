import type { KimiChatTool } from "./kimi-chat-types.js";
import { normalizeKimiToolSchema } from "./normalizeKimiToolSchema.js";
import type { Tool } from "./types.js";

export function toKimiChatTools(tools: readonly Tool[]): readonly KimiChatTool[] {
    return tools.map((tool) => ({
        function: {
            description: tool.description,
            name: tool.name,
            parameters: normalizeKimiToolSchema(tool.parameters as Record<string, unknown>),
        },
        type: "function",
    }));
}
