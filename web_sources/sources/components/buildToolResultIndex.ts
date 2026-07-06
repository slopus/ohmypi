import type { Message, ToolResultBlock } from "@/protocol";

/**
 * Indexes every tool_result block in the transcript by its toolCallId so that
 * tool_call blocks can be paired with their results across message boundaries
 * (results usually arrive in a later agent message than the call).
 */
export function buildToolResultIndex(
    messages: readonly Message[],
): ReadonlyMap<string, ToolResultBlock> {
    const index = new Map<string, ToolResultBlock>();
    for (const message of messages) {
        if (message.role !== "agent") {
            continue;
        }
        for (const block of message.blocks) {
            if (block.type === "tool_result") {
                index.set(block.toolCallId, block);
            }
        }
    }
    return index;
}
