import type { SessionCompactionMessage, SessionMessage } from "@/core/SessionContext.js";

export function restoreAnthropicBedrockCompaction(
    current: readonly SessionMessage[],
    rebuilt: readonly SessionMessage[],
): readonly SessionMessage[] {
    if (rebuilt.some((message) => message.role === "compaction")) return rebuilt;
    const compaction = current.findLast(
        (message): message is SessionCompactionMessage => message.role === "compaction",
    );
    if (compaction === undefined) return rebuilt;

    const summary = `<conversation_summary>\n${compaction.content}\n</conversation_summary>`;
    let replaced = false;
    return rebuilt.map((message) => {
        if (
            !replaced &&
            message.role === "user" &&
            message.content === summary &&
            (message.input === undefined ||
                (message.input.every((content) => content.type === "text") &&
                    message.input.map((content) => content.text).join("") === summary))
        ) {
            replaced = true;
            return compaction;
        }
        return message;
    });
}
