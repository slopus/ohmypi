import { createTimedSignal } from "../claude/webFetch/createTimedSignal.js";
import { readBoundedResponseText } from "./readBoundedResponseText.js";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export interface RequestGeminiInteractionOptions {
    apiKey: string;
    body: unknown;
    fetch?: typeof fetch;
    maximumResponseBytes: number;
    operation: string;
    signal?: AbortSignal;
    timeoutMs: number;
}

export async function requestGeminiInteraction(
    options: RequestGeminiInteractionOptions,
): Promise<unknown> {
    const timedSignal = createTimedSignal(options.signal, options.timeoutMs);
    try {
        const response = await (options.fetch ?? fetch)(GEMINI_INTERACTIONS_URL, {
            body: JSON.stringify(options.body),
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": options.apiKey,
            },
            method: "POST",
            signal: timedSignal.signal,
        });
        const raw = await readBoundedResponseText(response, options.maximumResponseBytes);
        let payload: unknown;
        try {
            payload = JSON.parse(raw);
        } catch {
            throw new Error(
                `Gemini ${options.operation} returned invalid JSON (${String(response.status)}).`,
            );
        }
        if (!response.ok) {
            const message = (payload as { error?: { message?: unknown } }).error?.message;
            throw new Error(
                `Gemini ${options.operation} failed (${String(response.status)}): ${typeof message === "string" ? message : response.statusText || "Unknown error"}`,
            );
        }
        return payload;
    } finally {
        timedSignal.dispose();
    }
}
