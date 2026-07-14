import type { ServerResponse } from "node:http";

import type { GlobalEventQueueEntry } from "../protocol/index.js";

export function writeGlobalSseEvent(response: ServerResponse, entry: GlobalEventQueueEntry): void {
    response.write(`id: ${entry.cursor}\n`);
    response.write(`event: ${entry.event.type}\n`);
    response.write(`data: ${JSON.stringify(entry.event)}\n\n`);
}
