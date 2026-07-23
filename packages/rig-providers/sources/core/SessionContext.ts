export interface SessionUserMessage {
    readonly role: "user";
    readonly content: string;
}

export interface SessionSystemMessage {
    readonly role: "system";
    readonly content: string | readonly string[];
}

export interface SessionAssistantMessage {
    readonly role: "assistant";
    readonly content: string;
    /** Opaque encrypted reasoning JSON from a prior Grok response. */
    readonly encryptedReasoning?: string;
}

export type SessionMessage = SessionSystemMessage | SessionUserMessage | SessionAssistantMessage;

/** Conversation context supplied by the caller for each run or compact. */
export interface SessionContext {
    readonly instructions: string;
    readonly messages: readonly SessionMessage[];
}
