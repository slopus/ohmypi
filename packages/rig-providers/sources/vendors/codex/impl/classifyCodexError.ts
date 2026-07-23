import type { SessionErrorKind } from "@/core/SessionEvent.js";

export function classifyCodexError(message: string): SessionErrorKind {
    if (/context|prompt.+too long|maximum context|token limit/iu.test(message))
        return "context_overflow";
    if (/billing|credit|quota|usage limit|insufficient_quota/iu.test(message))
        return "billing_error";
    if (
        /status 5\d\d|fetch failed|socket|websocket|timed? ?out|service unavailable/iu.test(message)
    )
        return "internal_error";
    return "unknown";
}
