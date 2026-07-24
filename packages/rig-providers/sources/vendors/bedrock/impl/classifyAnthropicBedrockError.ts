import { APIError } from "@anthropic-ai/sdk/error";

import type { SessionErrorKind } from "@/core/SessionEvent.js";

export function classifyAnthropicBedrockError(error: unknown): SessionErrorKind {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error);
    if (
        message.includes("context window") ||
        message.includes("context limit") ||
        message.includes("input is too long") ||
        message.includes("too many input tokens")
    ) {
        return "context_overflow";
    }
    if (
        message.includes("billing") ||
        message.includes("credit balance") ||
        message.includes("insufficient credit") ||
        message.includes("payment required")
    ) {
        return "billing_error";
    }
    if (error instanceof APIError) {
        if (error.status === 402) return "billing_error";
        if (error.status !== undefined && error.status >= 500) return "internal_error";
    }
    return "unknown";
}
