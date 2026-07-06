import { buildToolResultIndex } from "@/components/buildToolResultIndex";
import type { AssistantMessage, Message, ToolResultBlock } from "@/protocol";

export type ToolActivityStatus = "completed" | "error" | "interrupted" | "running";

/** One tool invocation derived from the transcript, paired with its result. */
export interface ToolActivityEntry {
    arguments: unknown;
    id: string;
    name: string;
    result: ToolResultBlock | undefined;
    status: ToolActivityStatus;
}

/**
 * Walks the transcript in order and pairs every tool_call block with its
 * tool_result (matched by toolCallId across all agent messages). Tool calls
 * still streaming in the live partial are appended as running entries.
 * Result-less calls only count as running while the session's run is active;
 * otherwise they are marked interrupted (aborts and run errors leave no result).
 */
export function collectToolActivity(
    messages: readonly Message[],
    streamingPartial: AssistantMessage | undefined,
    isSessionRunning: boolean,
): readonly ToolActivityEntry[] {
    const results = buildToolResultIndex(messages);

    const entries: ToolActivityEntry[] = [];
    const seen = new Set<string>();

    for (const message of messages) {
        if (message.role !== "agent") {
            continue;
        }
        for (const block of message.blocks) {
            if (block.type !== "tool_call" || seen.has(block.id)) {
                continue;
            }
            seen.add(block.id);
            const result = results.get(block.id);
            entries.push({
                arguments: block.arguments,
                id: block.id,
                name: block.name,
                result,
                status:
                    result === undefined
                        ? isSessionRunning
                            ? "running"
                            : "interrupted"
                        : result.isError === true
                          ? "error"
                          : "completed",
            });
        }
    }

    if (streamingPartial !== undefined) {
        for (const content of streamingPartial.content) {
            if (content.type !== "toolCall" || seen.has(content.id)) {
                continue;
            }
            seen.add(content.id);
            entries.push({
                arguments: content.arguments,
                id: content.id,
                name: content.name,
                result: undefined,
                status: "running",
            });
        }
    }

    return entries;
}
