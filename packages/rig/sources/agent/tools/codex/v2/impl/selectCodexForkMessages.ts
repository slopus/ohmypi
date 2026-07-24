import type { AgentMessage, Message } from "../../../../types.js";
import { selectCodexFinalAnswerBlocks } from "./selectCodexFinalAnswerBlocks.js";
import { selectCodexFinalAnswerItems } from "./selectCodexFinalAnswerItems.js";

export function selectCodexForkMessages(
    messages: readonly Message[],
    lastNTurns: number | undefined,
): readonly Message[] {
    const boundaries = messages.flatMap((message, index) =>
        message.role === "user" &&
        (message.provenance !== "agent" || message.agentMessageTriggerTurn === true)
            ? [index]
            : [],
    );
    const selected =
        lastNTurns === undefined
            ? messages
            : messages.slice(
                  boundaries[Math.max(0, boundaries.length - lastNTurns)] ?? messages.length,
              );
    return selected.flatMap((message): readonly Message[] => {
        if (message.role === "system") return [message];
        if (message.role === "user") {
            return message.provenance === "agent" || message.encryptedAgentMessage !== undefined
                ? []
                : [message];
        }
        const responseItems = selectCodexFinalAnswerItems(message.responseItems);
        const blocks = selectCodexFinalAnswerBlocks(responseItems);
        if (blocks.length === 0) return [];
        return [{ ...message, blocks, responseItems } satisfies AgentMessage];
    });
}
