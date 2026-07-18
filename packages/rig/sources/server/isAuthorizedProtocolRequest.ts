import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export function isAuthorizedProtocolRequest(request: IncomingMessage, token: string): boolean {
    const authorization = request.headers.authorization;
    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
        return false;
    }

    const received = Buffer.from(authorization.slice("Bearer ".length));
    const expected = Buffer.from(token);
    return received.length === expected.length && timingSafeEqual(received, expected);
}
