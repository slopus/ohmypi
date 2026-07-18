import { chmod, open } from "node:fs/promises";
import { createServer } from "node:http";

import { createProtocolHttpServer } from "./createProtocolHttpServer.js";
import {
    createDaemonStartupRequestListener,
    type DaemonStartupState,
} from "./createDaemonStartupRequestListener.js";
import { createModelCatalog } from "./createModelCatalog.js";
import { getEnvironmentLocalServerPaths } from "./getEnvironmentLocalServerPaths.js";
import { prepareLocalServerDirectory } from "./prepareLocalServerDirectory.js";
import { PersistentSessionStore } from "./PersistentSessionStore.js";
import { TrackedTaskDrain } from "./TrackedTaskDrain.js";
import { readLocalServerToken } from "./readLocalServerToken.js";
import { removeStaleSocket } from "./removeStaleSocket.js";
import { McpClientManager } from "../mcp/index.js";
import { loadConfig, writeDaemonSettings } from "../config/index.js";
import { createProviderQuotaService } from "../providers/createProviderQuotaService.js";
import { createCodingAssistantAgent } from "../runtime/createCodingAssistantAgent.js";
import { getDaemonIdentity } from "../daemon/index.js";
import { errorToMessage } from "../errorToMessage.js";

export interface RunLocalProtocolServerOptions {
    socketPath?: string;
    tokenPath?: string;
}

export async function runLocalProtocolServer(
    options: RunLocalProtocolServerOptions = {},
): Promise<void> {
    const paths = getEnvironmentLocalServerPaths();
    const socketPath = options.socketPath ?? paths.socketPath;
    const tokenPath = options.tokenPath ?? paths.tokenPath;
    await prepareLocalServerDirectory(paths.directory);
    const token = await readLocalServerToken(tokenPath);
    await removeStaleSocket(socketPath);

    let startupState: DaemonStartupState = { status: "starting" };
    let mcpToolProvider: McpClientManager | undefined;
    let store: PersistentSessionStore | undefined;
    let taskDrain: TrackedTaskDrain | undefined;
    let stopping = false;
    let resolveStopped: (() => void) | undefined;
    const stopped = new Promise<void>((resolve) => {
        resolveStopped = resolve;
    });
    const stopServer = () => {
        if (stopping) return;
        stopping = true;
        taskDrain?.beginClose();
        const serverClosed = new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
        void (async () => {
            if (store !== undefined) {
                try {
                    await store.prepareForShutdown("shutdown");
                } catch (error) {
                    console.error(
                        error instanceof Error
                            ? error.message
                            : `Failed to drain interrupted sessions: ${String(error)}`,
                    );
                }
            }
            server.closeAllConnections();
            await serverClosed;
            resolveStopped?.();
        })();
    };
    const startupRequestListener = createDaemonStartupRequestListener({
        getState: () => startupState,
        identity: getDaemonIdentity(),
        onShutdown: stopServer,
        token,
    });
    const server = createServer(startupRequestListener);
    let initialization = Promise.resolve();
    const reportStartupError = (error: unknown) => {
        if (stopping) return;
        const message = errorToMessage(error);
        startupState = { error: message, status: "error" };
        console.error(`Daemon startup failed: ${message}`);
    };
    try {
        const previousUmask = process.umask(0o077);
        try {
            await new Promise<void>((resolve, reject) => {
                server.once("error", reject);
                server.listen(socketPath, () => {
                    server.off("error", reject);
                    resolve();
                });
            });
        } finally {
            process.umask(previousUmask);
        }
        process.once("SIGINT", stopServer);
        process.once("SIGTERM", stopServer);
        try {
            await chmod(socketPath, 0o600);
            if (stopping) {
                await stopped;
                return;
            }
            await writeRegistry(paths.registryPath, {
                pid: process.pid,
                socketPath,
                startedAt: new Date().toISOString(),
            });
        } catch (error) {
            reportStartupError(error);
            await stopped;
            return;
        }
        if (stopping) {
            await stopped;
            return;
        }

        initialization = initializeDaemon().catch(reportStartupError);

        await stopped;
        await initialization;
    } finally {
        process.off("SIGINT", stopServer);
        process.off("SIGTERM", stopServer);
        await initialization;
        if (mcpToolProvider !== undefined) {
            try {
                await mcpToolProvider.close();
            } catch (error) {
                console.error(
                    error instanceof Error
                        ? `Failed to close MCP connections: ${error.message}`
                        : `Failed to close MCP connections: ${String(error)}`,
                );
            }
        }
        store?.close();
    }

    async function initializeDaemon(): Promise<void> {
        const loadedConfig = await loadConfig({ cwd: process.cwd() });
        if (stopping) return;

        const providerQuotaService = createProviderQuotaService({ cwd: process.cwd() });
        const modelCatalog = createModelCatalog({
            cwd: process.cwd(),
            providers: loadedConfig.config.providers,
        });
        mcpToolProvider = new McpClientManager();
        taskDrain = new TrackedTaskDrain();
        store = new PersistentSessionStore({
            createRuntime: (options) =>
                createCodingAssistantAgent({
                    ...options,
                    providers: loadedConfig.config.providers,
                }),
            databasePath: paths.databasePath,
            durableGlobalEventQueue: loadedConfig.config.settings.durableGlobalEventQueue,
            mcpToolProvider,
            modelCatalog,
            taskDrain,
        });
        if (stopping) {
            taskDrain.beginClose();
            return;
        }

        createProtocolHttpServer(
            {
                ...(loadedConfig.config.docker === undefined
                    ? {}
                    : { defaultDocker: loadedConfig.config.docker }),
                ...(store.globalEventQueue === undefined
                    ? {}
                    : { globalEventQueue: store.globalEventQueue }),
                modelCatalog,
                getProviderQuota: (providerId) => providerQuotaService.get(providerId),
                onDurableGlobalEventQueueChange: async (enabled) => {
                    await writeDaemonSettings({ durableGlobalEventQueue: enabled });
                    return store?.setDurableGlobalEventQueue(enabled);
                },
                onShutdown: stopServer,
                store,
                taskDrain,
                token,
            },
            server,
        );
        server.off("request", startupRequestListener);
    }
}

async function writeRegistry(path: string, payload: unknown): Promise<void> {
    const file = await open(path, "w", 0o600);
    try {
        await file.writeFile(`${JSON.stringify(payload, null, 2)}\n`);
        await file.chmod(0o600);
    } finally {
        await file.close();
    }
}
