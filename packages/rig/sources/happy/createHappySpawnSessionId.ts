import { createHash } from "node:crypto";

export function createHappySpawnSessionId(machineId: string, clientRequestId: string): string {
    return `happy-rig-${createHash("sha256")
        .update(machineId)
        .update("\0")
        .update(clientRequestId)
        .digest("base64url")}`;
}
