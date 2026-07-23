import type { SessionCacheUsage } from "@/core/SessionCacheUsage.js";

export type SessionDoneState = "normal" | "tool_call" | "length" | "error";

export type SessionErrorKind = "internal_error" | "context_overflow" | "billing_error" | "unknown";

/** Streaming events emitted during a single session run. */
export type SessionEvent =
    | { type: "text_delta"; delta: string }
    | { type: "reasoning_delta"; delta: string }
    | { type: "encrypted_reasoning"; content: string }
    | { type: "tool_call_delta"; callId: string; delta: string }
    | { type: "server_tool_call_delta"; callId: string; delta: string }
    | { type: "retrying"; attempt: number; reason: string }
    | { type: "token_usage"; usage: SessionCacheUsage }
    | { type: "done"; state: "normal" }
    | { type: "done"; state: "tool_call" }
    | { type: "done"; state: "length" }
    | { type: "done"; state: "error"; kind: SessionErrorKind; message: string };

export type SessionStream = AsyncIterable<SessionEvent>;

export function isSessionDoneEvent(
    event: SessionEvent,
): event is Extract<SessionEvent, { type: "done" }> {
    return event.type === "done";
}

export function isSessionErrorDone(
    event: SessionEvent,
): event is Extract<SessionEvent, { type: "done"; state: "error" }> {
    return event.type === "done" && event.state === "error";
}
