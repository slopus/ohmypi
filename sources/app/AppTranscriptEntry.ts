export type AppTranscriptRole =
    | "system"
    | "user"
    | "assistant"
    | "thinking"
    | "tool"
    | "event"
    | "error"
    | "separator";

export interface AppTranscriptEntry {
    id: string;
    role: AppTranscriptRole;
    text: string;
    detail?: string;
    title?: string;
}
