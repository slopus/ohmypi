import type { SessionErrorKind } from "@/core/SessionEvent.js";

const CONTEXT_OVERFLOW_PATTERNS = [
    "too long for this model",
    "prompt is too long",
    "maximum prompt length",
    "maximum context length",
    "context_length_exceeded",
] as const;

const BILLING_PATTERNS = [
    "subscription:free-usage-exhausted",
    "free grok build usage limit",
    "credit balance is too low",
    "out of credits",
    "insufficient credits",
    "payment required",
    "purchase more credits",
] as const;

const INTERNAL_ERROR_PATTERNS = [
    "internal server error",
    "serialization error",
    "inference idle timeout",
    "empty response from model",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "reqwest error stream",
    "stream error",
    "eventstreamerror",
] as const;

/** Mirrors `xai_grok_sampling_types::is_context_length_error`. */
export function isGrokContextOverflowError(message: string): boolean {
    const normalized = message.toLowerCase();
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/** Mirrors grok-build free-usage and credit-exhaustion sniffers. */
export function isGrokBillingError(message: string): boolean {
    const normalized = message.toLowerCase();
    return BILLING_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function classifyGrokError(message: string): SessionErrorKind {
    if (isGrokContextOverflowError(message)) {
        return "context_overflow";
    }
    if (isGrokBillingError(message)) {
        return "billing_error";
    }
    if (isGrokInternalError(message)) {
        return "internal_error";
    }
    return "unknown";
}

function isGrokInternalError(message: string): boolean {
    const normalized = message.toLowerCase();
    if (/(?:^|\D)5\d{2}(?:\D|$)/u.test(message)) {
        return true;
    }
    return INTERNAL_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}
