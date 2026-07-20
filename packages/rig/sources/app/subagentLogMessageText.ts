import type { Message } from "../agent/types.js";

export function subagentLogMessageText(message: Message): string {
    return message.blocks
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("\n")
        .trim();
}
