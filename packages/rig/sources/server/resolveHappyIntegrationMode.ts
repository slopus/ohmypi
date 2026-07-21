import type { HappyIntegrationMode } from "./loadHappyIntegration.js";
import { isHappySyncDisabled } from "./isHappySyncDisabled.js";

export function resolveHappyIntegrationMode(
    hostMode: HappyIntegrationMode | undefined,
    configured: boolean,
    environment: NodeJS.ProcessEnv = process.env,
): HappyIntegrationMode {
    if (isHappySyncDisabled(environment)) return "disabled";
    return hostMode === "enabled" && configured ? "enabled" : "disabled";
}
