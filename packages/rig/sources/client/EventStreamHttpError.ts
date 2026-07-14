export class EventStreamHttpError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number) {
        super(`SSE failed with HTTP ${statusCode}`);
        this.name = "EventStreamHttpError";
        this.statusCode = statusCode;
    }
}
