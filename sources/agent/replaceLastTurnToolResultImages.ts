import type { AgentMessage, Message, ToolResultBlock } from "./types.js";

export function replaceLastTurnToolResultImages(
    messages: Message[],
    replacementText: string,
): AgentMessage[] {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.role === "user") {
            return [];
        }
        if (message?.role !== "agent") {
            continue;
        }

        for (let blockIndex = message.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
            const block = message.blocks[blockIndex];
            if (block?.type !== "tool_result") {
                continue;
            }
            if (!block.rendered.some((content) => content.type === "image")) {
                return [];
            }

            const replacementBlock: ToolResultBlock = {
                ...block,
                display: replacementText,
                rendered: block.rendered.map((content) =>
                    content.type === "image"
                        ? { type: "text" as const, text: replacementText }
                        : content,
                ),
            };
            const blocks = [...message.blocks];
            blocks[blockIndex] = replacementBlock;
            const replacement: AgentMessage = { ...message, blocks };
            messages[index] = replacement;
            return [replacement];
        }
    }

    return [];
}
