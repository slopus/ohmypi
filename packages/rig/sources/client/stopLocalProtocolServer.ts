import type { ProtocolHttpClient } from "./ProtocolHttpClient.js";
import { readLocalServerProcessId } from "../server/index.js";
import { waitForProcessExit } from "../processes/index.js";
import { errorToMessage } from "../errorToMessage.js";

const DAEMON_SHUTDOWN_TIMEOUT_MS = 10_000;

export async function stopLocalProtocolServer(
    client: ProtocolHttpClient,
    registryPath: string,
): Promise<void> {
    const registeredProcessId = await readLocalServerProcessId(registryPath);
    let response: Awaited<ReturnType<ProtocolHttpClient["shutdown"]>>;
    try {
        response = await client.shutdown();
    } catch (error) {
        if (
            registeredProcessId !== undefined &&
            (await waitForProcessExit(registeredProcessId, DAEMON_SHUTDOWN_TIMEOUT_MS))
        ) {
            return;
        }
        throw new Error(`Could not stop the existing local daemon: ${errorToMessage(error)}`);
    }
    const processId =
        response.pid !== undefined && Number.isSafeInteger(response.pid) && response.pid > 0
            ? response.pid
            : registeredProcessId;
    if (processId === undefined) {
        throw new Error(
            "Rig could not identify the running daemon process, so it did not start a replacement. Stop the daemon, then try again.",
        );
    }
    if (!(await waitForProcessExit(processId, DAEMON_SHUTDOWN_TIMEOUT_MS))) {
        throw new Error(
            "Timed out while waiting for the existing local daemon to stop. Rig did not start a replacement.",
        );
    }
}
