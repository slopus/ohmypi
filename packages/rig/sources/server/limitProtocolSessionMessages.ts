import type { ProtocolSession } from "../protocol/index.js";

export function limitProtocolSessionMessages(
    session: ProtocolSession,
    messageLimit: number | undefined,
): ProtocolSession {
    if (messageLimit === undefined) return session;

    const { contextMessages: _contextMessages, ...snapshot } = session.snapshot;

    return {
        ...session,
        snapshot: {
            ...snapshot,
            messages: snapshot.messages.slice(-messageLimit),
        },
    };
}
