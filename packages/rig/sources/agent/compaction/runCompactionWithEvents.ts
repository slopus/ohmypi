import type { AgentLoopEvent } from "../loop.js";
import type { CompactConversationResult } from "./compactConversation.js";

export async function runCompactionWithEvents(options: {
    compact: (
        onCompactionStart: (event: { estimatedTokensBefore: number }) => void | Promise<void>,
    ) => Promise<CompactConversationResult>;
    idFactory: () => string;
    now: () => number;
    onEvent: (event: AgentLoopEvent) => void | Promise<void>;
    reason: "context_window" | "manual" | "threshold";
    signal?: AbortSignal;
}): Promise<CompactConversationResult> {
    let lifecycle:
        | {
              compactionId: string;
              startedAt: number;
          }
        | undefined;
    let status: "cancelled" | "completed" | "failed" = "failed";

    try {
        const result = await options.compact(async ({ estimatedTokensBefore }) => {
            lifecycle = {
                compactionId: options.idFactory(),
                startedAt: options.now(),
            };
            await options.onEvent({
                type: "context_compaction_started",
                compactionId: lifecycle.compactionId,
                estimatedTokensBefore,
                reason: options.reason,
            });
        });
        status = "completed";
        if (result.compacted && lifecycle !== undefined) {
            await options.onEvent({
                type: "context_compacted",
                compactionId: lifecycle.compactionId,
                compactedMessageCount: result.compactedMessageCount,
                elapsedMs: Math.max(0, options.now() - lifecycle.startedAt),
                estimatedTokensAfter: result.estimatedTokensAfter,
                estimatedTokensBefore: result.estimatedTokensBefore,
                reason: options.reason,
            });
        }
        return result;
    } catch (error) {
        status = options.signal?.aborted === true ? "cancelled" : "failed";
        throw error;
    } finally {
        if (lifecycle !== undefined) {
            await options.onEvent({
                type: "context_compaction_finished",
                compactionId: lifecycle.compactionId,
                elapsedMs: Math.max(0, options.now() - lifecycle.startedAt),
                status,
            });
        }
    }
}
