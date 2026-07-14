import type { PartialRigConfig } from "./types.js";

export function withoutProjectDaemonSettings(config: PartialRigConfig): PartialRigConfig {
    if (config.settings?.durableGlobalEventQueue === undefined) return config;
    const { durableGlobalEventQueue: _durableGlobalEventQueue, ...settings } = config.settings;
    const { settings: _settings, ...rest } = config;
    return Object.keys(settings).length === 0 ? rest : { ...rest, settings };
}
