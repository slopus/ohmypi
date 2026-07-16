import type { DaemonIdentity } from "../protocol/index.js";

export function daemonIdentitiesMatch(current: DaemonIdentity, running: DaemonIdentity): boolean {
    return (
        current.version === running.version &&
        current.developmentBuildId === running.developmentBuildId
    );
}
