import type { IncomingMessage, ServerResponse } from "node:http";

import type { GlobalEventQueue } from "./GlobalEventQueue.js";
import { parseGlobalEventCursor } from "./parseGlobalEventCursor.js";
import { sendJson } from "./sendJson.js";
import { writeGlobalSseEvent } from "./writeGlobalSseEvent.js";

export function streamGlobalEvents(
    request: IncomingMessage,
    response: ServerResponse,
    queue: GlobalEventQueue,
    afterValue: string | null,
): void {
    const lastEventId = request.headers["last-event-id"];
    const cursorValue = Array.isArray(lastEventId) ? lastEventId.at(-1) : lastEventId;
    const selectedValue = cursorValue ?? afterValue;
    const after = parseGlobalEventCursor(selectedValue ?? null);
    if (selectedValue !== undefined && selectedValue !== null && after === undefined) {
        sendJson(response, 400, { error: "The event cursor must be a whole number." });
        return;
    }

    const catchupLimit = 1_000;
    let catchup = queue.list({
        ...(after === undefined ? {} : { after }),
        limit: catchupLimit,
    });
    if (catchup === undefined) {
        sendJson(response, 409, { error: "The global event cursor is not available." });
        return;
    }

    response.writeHead(200, {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
    });
    response.write(": connected\n\n");

    for (;;) {
        for (const entry of catchup) writeGlobalSseEvent(response, entry);
        if (catchup.length < catchupLimit) break;
        const nextCursor: number | undefined = catchup.at(-1)?.cursor;
        if (nextCursor === undefined) break;
        catchup = queue.list({ after: nextCursor, limit: catchupLimit }) ?? [];
    }

    const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15_000);
    heartbeat.unref?.();
    let closed = false;
    let unsubscribe = () => {};
    const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        response.end();
    };
    unsubscribe = queue.subscribe((entry) => writeGlobalSseEvent(response, entry), close);
    request.on("close", close);
}
