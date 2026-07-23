import type {
    ResponseInput,
    ResponseInputItem,
    ResponseReasoningItem,
} from "openai/resources/responses/responses.js";

import type { SessionContext } from "@/core/SessionContext.js";

export function toGrokResponseInput(context: SessionContext): ResponseInput {
    const input: ResponseInput = [];
    let fallbackMessageId = 0;

    for (const message of context.messages) {
        if (message.role === "system") {
            input.push({
                type: "message",
                role: "developer",
                content:
                    typeof message.content === "string"
                        ? message.content
                        : message.content.map((text) => ({ type: "input_text", text })),
            });
            continue;
        }
        if (message.role === "user") {
            input.push({
                type: "message",
                role: "user",
                content: message.content,
            });
            continue;
        }

        if (message.encryptedReasoning !== undefined) {
            try {
                const reasoning = JSON.parse(message.encryptedReasoning) as ResponseReasoningItem;
                if (reasoning.type === "reasoning") {
                    input.push(reasoning);
                }
            } catch {
                // Ignore malformed opaque reasoning from an earlier response.
            }
        }

        input.push({
            type: "message",
            id: `msg_${fallbackMessageId++}`,
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: message.content, annotations: [] }],
        } as ResponseInputItem);
    }

    return input;
}
