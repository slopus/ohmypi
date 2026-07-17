import type { KimiChatMessage, KimiChatTextPart } from "./kimi-chat-types.js";
import { createKimiToolCallIdMap } from "./createKimiToolCallIdMap.js";
import type { Context, UserContent } from "./types.js";

export function toKimiChatMessages(context: Context): readonly KimiChatMessage[] {
    const messages: KimiChatMessage[] = [];
    if (context.systemPrompt?.length) {
        messages.push({ content: context.systemPrompt, role: "system" });
    }
    const toolCallIds = createKimiToolCallIdMap(context.messages);
    for (const message of context.messages) {
        if (message.role === "user") {
            messages.push({ content: toKimiUserContent(message.content), role: "user" });
            continue;
        }
        if (message.role === "toolResult") {
            messages.push({
                content: toKimiUserContent(message.content),
                role: "tool",
                tool_call_id: toolCallIds.get(message.toolCallId) ?? message.toolCallId,
            });
            continue;
        }

        const text = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
        const reasoning = message.content
            .flatMap((block) =>
                block.type === "thinking" && block.encrypted === undefined ? [block.thinking] : [],
            )
            .join("");
        const toolCalls = message.content.flatMap((block) =>
            block.type === "toolCall"
                ? [
                      {
                          function: {
                              arguments: JSON.stringify(block.arguments),
                              name: block.name,
                          },
                          id: toolCallIds.get(block.id) ?? block.id,
                          type: "function" as const,
                      },
                  ]
                : [],
        );
        messages.push({
            role: "assistant",
            reasoning_content: reasoning,
            ...(text.trim().length === 0 ? {} : { content: text }),
            ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
        });
    }
    return messages;
}

function toKimiUserContent(content: string | readonly UserContent[]) {
    if (typeof content === "string") return content;
    const parts = content.map((block) => {
        if (block.type === "text") {
            return { text: block.text, type: "text" } satisfies KimiChatTextPart;
        }
        return {
            image_url: {
                ...(block.detail === undefined ? {} : { detail: block.detail }),
                url: `data:${block.mimeType};base64,${block.data}`,
            },
            type: "image_url" as const,
        };
    });
    const only = parts[0];
    return parts.length === 1 && only?.type === "text" ? only.text : parts;
}
