import type { AssistantMessage } from "../providers/types.js";

const RETRYABLE_ERROR_CODES = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETDOWN",
    "ENETUNREACH",
    "EPIPE",
    "ETIMEDOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
]);

const RETRYABLE_MESSAGE_PATTERNS = [
    /\bfetch failed\b/iu,
    /\bnetwork error\b/iu,
    /\bconnection (?:closed|failed|lost|reset)\b/iu,
    /\bsocket (?:closed|disconnected|hang up)\b/iu,
    /\bstream disconnected\b/iu,
    /\bpremature close\b/iu,
    /\bterminated\b/iu,
    /\btimed? ?out\b/iu,
    /\bHTTP (?:408|429|5\d\d)\b/iu,
    /\bstatus(?: code)?[ :=]+(?:408|429|5\d\d)\b/iu,
    /\bAn error occurred while processing your request\. You can retry your request\b/iu,
];

export function isRetryableInferenceError(value: unknown): boolean {
    if (isAbortError(value)) return false;

    const code = errorCode(value);
    if (code !== undefined && RETRYABLE_ERROR_CODES.has(code)) return true;

    const message = errorMessage(value);
    return (
        message !== undefined && RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
    );
}

function errorMessage(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (isAssistantMessage(value)) return value.errorMessage;
    if (value instanceof Error) {
        const cause = errorMessage(value.cause);
        return cause === undefined ? value.message : `${value.message}: ${cause}`;
    }
    if (isRecord(value) && typeof value.message === "string") return value.message;
    return undefined;
}

function errorCode(value: unknown): string | undefined {
    if (!isRecord(value)) return undefined;
    if (typeof value.code === "string") return value.code;
    return errorCode(value.cause);
}

function isAbortError(value: unknown): boolean {
    if (!isRecord(value)) return false;
    return value.name === "AbortError" || value.code === "ABORT_ERR";
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
    return isRecord(value) && value.role === "assistant";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
