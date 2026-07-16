import type { ConfigProvider, ConfigProviders } from "./types.js";

export function findConfiguredProvider(
    providers: ConfigProviders,
    providerId: string,
): ConfigProvider | undefined {
    return providers[providerId];
}
