import type { SubmitMessageRequest } from "../protocol/index.js";

export function isSubmitMessageRequest(value: unknown): value is SubmitMessageRequest {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof (value as { text?: unknown }).text === "string"
    );
}
