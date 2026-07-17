import type { Context } from "./types.js";

export function createKimiToolCallIdMap(
    messages: Context["messages"],
): ReadonlyMap<string, string> {
    const ids: string[] = [];
    const seen = new Set<string>();
    const append = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        ids.push(id);
    };
    for (const message of messages) {
        if (message.role === "assistant") {
            for (const block of message.content) {
                if (block.type === "toolCall") append(block.id);
            }
        } else if (message.role === "toolResult") {
            append(message.toolCallId);
        }
    }

    const result = new Map<string, string>();
    const used = new Set<string>();
    for (const id of ids) {
        const normalized = id.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 64) || "tool_call";
        let candidate = normalized;
        for (let suffix = 2; used.has(candidate); suffix += 1) {
            const ending = `_${suffix}`;
            candidate = `${normalized.slice(0, 64 - ending.length)}${ending}`;
        }
        result.set(id, candidate);
        used.add(candidate);
    }
    return result;
}
