import { contentBlockToText } from "./contentBlockToText.js";
import type { AgentMessage } from "./types.js";

export function agentMessageToText(message: AgentMessage): string {
    return message.blocks
        .map((block) => {
            if (block.type === "text") {
                return block.text;
            }

            if (block.type === "image") {
                return `[image:${block.mediaType}]`;
            }

            if (block.type === "thinking") {
                return `[thinking] ${block.thinking}`;
            }

            if (block.type === "tool_call") {
                return `[tool_call:${block.name}:${block.id}]`;
            }

            return `[tool_result:${block.toolName}:${block.toolCallId}] ${block.rendered.map(contentBlockToText).join("")}`;
        })
        .join("\n");
}
