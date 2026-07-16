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

        const hasToolResult = message.blocks.some((block) => block.type === "tool_result");
        if (!hasToolResult) continue;

        let replacedImage = false;
        const blocks = message.blocks.map((block) => {
            if (
                block.type !== "tool_result" ||
                !block.rendered.some((content) => content.type === "image")
            ) {
                return block;
            }

            replacedImage = true;
            return {
                ...block,
                display: replacementText,
                rendered: block.rendered.map((content) =>
                    content.type === "image"
                        ? { type: "text" as const, text: replacementText }
                        : content,
                ),
            } satisfies ToolResultBlock;
        });
        if (!replacedImage) return [];

        const replacement: AgentMessage = { ...message, blocks };
        messages[index] = replacement;
        return [replacement];
    }

    return [];
}
