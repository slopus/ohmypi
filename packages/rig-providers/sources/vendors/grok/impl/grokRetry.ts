const RETRYABLE_ERROR_CODES = new Set([
    "EAI_AGAIN",
    "ECONNABORTED",
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETDOWN",
    "ENETUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
]);

const TRANSPORT_MESSAGE_PATTERNS = [
    /^fetch failed$/iu,
    /^WebSocket error$/iu,
    /^WebSocket closed(?: 1006)?$/iu,
    /^stream disconnected before completion(?:: .+)?$/iu,
];

export function isRetryableGrokError(value: unknown): boolean {
    if (isAbortError(value)) return false;

    const code = errorCode(value);
    if (code !== undefined && RETRYABLE_ERROR_CODES.has(code)) return true;

    const message = errorMessage(value);
    return (
        message !== undefined && TRANSPORT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
    );
}

export function delayBeforeGrokRetry(attempt: number, signal?: AbortSignal): Promise<void> {
    const delayMs = Math.min(2_000, 200 * 2 ** Math.max(0, attempt - 1));
    if (signal?.aborted) return Promise.resolve();
    return new Promise((resolve) => {
        const timeout = setTimeout(resolve, delayMs);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timeout);
                resolve();
            },
            { once: true },
        );
    });
}

function errorMessage(value: unknown): string | undefined {
    if (typeof value === "string") return value;
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
