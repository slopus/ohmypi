import type { ServerResponse } from "node:http";

export function sendJson<T>(response: ServerResponse, statusCode: number, payload: T): void {
    if (response.headersSent) return;

    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(body),
        "content-type": "application/json; charset=utf-8",
    });
    response.end(body);
}
