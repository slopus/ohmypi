import type { ConfigKimiProvider } from "../config/types.js";
import { createKimiProvider } from "./kimi.js";
import type { Provider } from "./types.js";

export function createConfiguredKimiProvider(options: {
    apiKey?: string;
    config: ConfigKimiProvider;
    env: NodeJS.ProcessEnv;
    id: string;
    sessionId?: string;
}): Provider {
    const baseUrl = options.config.baseUrl ?? options.env.RIG_KIMI_BASE_URL;
    return createKimiProvider({
        env: options.env,
        id: options.id,
        ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
        ...(options.config.authFile === undefined ? {} : { authFile: options.config.authFile }),
        ...(baseUrl === undefined ? {} : { baseUrl }),
        ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
    });
}
