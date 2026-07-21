export class ProtocolHttpError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.name = "ProtocolHttpError";
        this.statusCode = statusCode;
    }
}
