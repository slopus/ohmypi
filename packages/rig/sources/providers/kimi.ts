import type { KimiChatClient } from "./kimi-chat-types.js";
import { KIMI_API_MODEL_ID, KIMI_DEFAULT_BASE_URL, KIMI_PROVIDER_ID } from "./kimi-constants.js";
import { createKimiStream } from "./createKimiStream.js";
import { modelMoonshotKimiK3 } from "./models.js";
import { resolveKimiCredential } from "./resolveKimiCredential.js";
import { defineProvider, type Provider } from "./types.js";

export interface KimiProviderOptions {
    apiKey?: string;
    authFile?: string;
    baseUrl?: string;
    clientFactory?: (options: {
        baseUrl: string;
        headers: Record<string, string>;
        token: string;
    }) => KimiChatClient;
    env?: NodeJS.ProcessEnv;
    id?: string;
    resolveCredential?: typeof resolveKimiCredential;
    sessionId?: string;
}

export function createKimiProvider(options: KimiProviderOptions = {}): Provider {
    const providerId = options.id ?? KIMI_PROVIDER_ID;
    const models = [modelMoonshotKimiK3];
    return defineProvider({
        id: providerId,
        imageProfile: () => "codex",
        models,
        toolProfile: () => "kimi",
        stream(model, context, streamOptions) {
            const availableModel = models.find((candidate) => candidate.id === model.id);
            if (availableModel === undefined) {
                throw new Error(`Kimi model '${model.name}' is not available.`);
            }
            return createKimiStream({
                apiModelId: KIMI_API_MODEL_ID,
                baseUrl: options.baseUrl ?? KIMI_DEFAULT_BASE_URL,
                context,
                model: availableModel,
                modelId: availableModel.id,
                providerId,
                ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
                ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
                ...(options.clientFactory === undefined
                    ? {}
                    : { clientFactory: options.clientFactory }),
                ...(options.env === undefined ? {} : { env: options.env }),
                ...(options.resolveCredential === undefined
                    ? {}
                    : { resolveCredential: options.resolveCredential }),
                ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
                ...(streamOptions === undefined ? {} : { streamOptions }),
            });
        },
    });
}

export type KimiProvider = ReturnType<typeof createKimiProvider>;
