import type { EventId, SessionEvent } from "../protocol/index.js";

export type SessionEventListener = (event: SessionEvent) => void;
export type SessionEventAppendHook = (event: SessionEvent) => void;

export class SessionEventLog {
    #events: SessionEvent[] = [];
    #lastEventId: EventId | undefined;
    #listeners = new Set<SessionEventListener>();
    #omittedEventIds = new Set<EventId>();
    #onAppend: SessionEventAppendHook | undefined;

    constructor(
        options: {
            events?: readonly SessionEvent[];
            lastEventId?: EventId;
            onAppend?: SessionEventAppendHook;
        } = {},
    ) {
        this.#events = [...(options.events ?? [])];
        this.#lastEventId = options.lastEventId ?? this.#events.at(-1)?.id;
        if (
            options.lastEventId !== undefined &&
            !this.#events.some((event) => event.id === options.lastEventId)
        ) {
            this.#omittedEventIds.add(options.lastEventId);
        }
        this.#onAppend = options.onAppend;
    }

    append(event: SessionEvent): SessionEvent {
        this.#onAppend?.(event);
        this.#events.push(event);
        this.#lastEventId = event.id;
        for (const listener of this.#listeners) {
            listener(event);
        }
        return event;
    }

    firstCreatedAt(): number | undefined {
        return this.#events.at(0)?.createdAt;
    }

    lastEventId(): EventId | undefined {
        return this.#lastEventId;
    }

    lastCreatedAt(): number | undefined {
        return this.#events.at(-1)?.createdAt;
    }

    since(eventId: EventId | undefined): readonly SessionEvent[] | undefined {
        if (eventId === undefined || eventId.length === 0) {
            return [...this.#events];
        }

        const index = this.#events.findIndex((event) => event.id === eventId);
        if (index >= 0) return this.#events.slice(index + 1);

        if (!this.#omittedEventIds.has(eventId)) return undefined;
        return this.#events.filter((event) => event.id > eventId);
    }

    subscribe(listener: SessionEventListener): () => void {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }
}
