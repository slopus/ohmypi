import { loadConfig } from "./loadConfig.js";
import type { DaemonSettings, LoadConfigOptions } from "./types.js";

export async function loadDaemonSettings(options: LoadConfigOptions = {}): Promise<DaemonSettings> {
    const loaded = await loadConfig(options);
    return {
        durableGlobalEventQueue: loaded.config.settings.durableGlobalEventQueue,
    };
}
