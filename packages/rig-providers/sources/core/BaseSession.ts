import type { SessionContext } from "@/core/SessionContext.js";
import type { SessionEvent, SessionStream } from "@/core/SessionEvent.js";
import type { SessionRunRequest } from "@/core/SessionRunRequest.js";

export abstract class BaseSession {
    readonly id: string;
    protected constructor(id: string) {
        this.id = id;
    }

    abstract run(request: SessionRunRequest): SessionStream;

    abstract compact(signal?: AbortSignal): Promise<SessionContext>;

    abstract destroy(): void | Promise<void>;
}

export type { SessionContext, SessionEvent, SessionRunRequest, SessionStream };
