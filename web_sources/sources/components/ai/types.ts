// Local replacements for the types AI Elements normally imports from the
// `ai` package. Kept intentionally minimal — only what the vendored
// components in this directory actually use.

/** Lifecycle of a prompt submission (mirrors the AI SDK ChatStatus). */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/** A file attached to a prompt or message (mirrors the AI SDK FileUIPart). */
export type FileUIPart = {
    type: "file";
    /** Object URL or data URL used for previews. */
    url?: string;
    filename?: string;
    mediaType?: string;
};

/**
 * Lifecycle of a tool invocation (mirrors the AI SDK ToolUIPart state, plus a
 * local "interrupted" state for calls whose run ended before a result arrived).
 */
export type ToolState =
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | "interrupted";
