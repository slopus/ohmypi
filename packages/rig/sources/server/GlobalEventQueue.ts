import type { GlobalEventQueueEntry, TrimGlobalEventsResponse } from "../protocol/index.js";

export interface ListGlobalEventQueueOptions {
    after?: number;
    limit?: number;
}

export type GlobalEventQueueListener = (entry: GlobalEventQueueEntry) => void;

export interface GlobalEventQueue {
    list(options?: ListGlobalEventQueueOptions): readonly GlobalEventQueueEntry[] | undefined;
    subscribe(listener: GlobalEventQueueListener, onClose?: () => void): () => void;
    trim(through: number): TrimGlobalEventsResponse | undefined;
}
