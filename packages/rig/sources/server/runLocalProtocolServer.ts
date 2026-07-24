import { chmod, open } from "node:fs/promises";
import { createServer } from "node:http";

import { createProtocolHttpServer } from "./createProtocolHttpServer.js";
import { DaemonLog } from "./DaemonLog.js";
import { configureSessionRequest } from "./configureSessionRequest.js";
import {
    createDaemonStartupRequestListener,
    type DaemonStartupState,
} from "./createDaemonStartupRequestListener.js";
import { createModelCatalog } from "./createModelCatalog.js";
import { getEnvironmentLocalServerPaths } from "./getEnvironmentLocalServerPaths.js";
import { installDaemonProcessFailureLogging } from "./installDaemonProcessFailureLogging.js";
import { loadHappyIntegration, type HappyIntegrationMode } from "./loadHappyIntegration.js";
import { prepareLocalServerDirectory } from "./prepareLocalServerDirectory.js";
import { PersistentSessionStore } from "./PersistentSessionStore.js";
import { TrackedTaskDrain } from "./TrackedTaskDrain.js";
import { readLocalServerToken } from "./readLocalServerToken.js";
import { removeStaleSocket } from "./removeStaleSocket.js";
import { resolveHappyIntegrationMode } from "./resolveHappyIntegrationMode.js";
import { McpClientManager } from "../mcp/index.js";
import { loadConfig, writeDaemonSettings } from "../config/index.js";
import { createProviderQuotaService } from "../executor/createProviderQuotaService.js";
import { disableUnavailableProviders } from "../executor/disableUnavailableProviders.js";
import { resolveProviderDisabledReasons } from "../executor/resolveProviderDisabledReasons.js";
import { createCodingAssistantAgent } from "../runtime/createCodingAssistantAgent.js";
import { getDaemonIdentity } from "../daemon/index.js";
import { errorToMessage } from "../errorToMessage.js";
import { getNodeInspectorUrl, openNodeInspector, registerRigDebugRoot } from "../debug/index.js";
import type { HappySyncService } from "../happy/index.js";

export interface RunLocalProtocolServerOptions {
    happyIntegration?: HappyIntegrationMode;
    socketPath?: string;
    tokenPath?: string;
}

export async function runLocalProtocolServer(
    options: RunLocalProtocolServerOptions = {},
): Promise<void> {
    const paths = getEnvironmentLocalServerPaths();
    const socketPath = options.socketPath ?? paths.socketPath;
    const tokenPath = options.tokenPath ?? paths.tokenPath;
    const startedAt = new Date().toISOString();
    await prepareLocalServerDirectory(paths.directory);
    const identity = getDaemonIdentity();
    const daemonLog = new DaemonLog({ path: paths.logPath, version: identity.version });
    daemonLog.record("info", "daemon_starting", "Rig daemon is starting.", {
        databasePath: paths.databasePath,
        ...(identity.developmentBuildId === undefined
            ? {}
            : { developmentBuildId: identity.developmentBuildId }),
        socketPath,
    });
    const uninstallProcessFailureLogging = installDaemonProcessFailureLogging(daemonLog);
    let token: string;
    try {
        token = await readLocalServerToken(tokenPath);
        await removeStaleSocket(socketPath);
    } catch (error) {
        daemonLog.record("error", "daemon_startup_failed", "Rig daemon could not start.", {
            error: errorToMessage(error),
        });
        uninstallProcessFailureLogging();
        throw error;
    }

    let startupState: DaemonStartupState = { status: "starting" };
    let mcpToolProvider: McpClientManager | undefined;
    let happySyncService: HappySyncService | undefined;
    let happyLifecycle = Promise.resolve();
    let store: PersistentSessionStore | undefined;
    let taskDrain: TrackedTaskDrain | undefined;
    let stopping = false;
    let resolveStopped: (() => void) | undefined;
    const stopped = new Promise<void>((resolve) => {
        resolveStopped = resolve;
    });
    const runHappyLifecycle = <T>(operation: () => Promise<T>): Promise<T> => {
        const next = happyLifecycle.then(operation, operation);
        happyLifecycle = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    };
    const stopServer = (reason = "Shutdown requested.") => {
        if (stopping) return;
        stopping = true;
        daemonLog.record("info", "daemon_stopping", "Rig daemon is stopping.", { reason });
        taskDrain?.beginClose();
        void (async () => {
            if (store !== undefined) {
                try {
                    await store.prepareForShutdown("shutdown");
                } catch (error) {
                    daemonLog.record(
                        "error",
                        "daemon_shutdown_drain_failed",
                        "Rig daemon could not finish draining interrupted sessions.",
                        { error: errorToMessage(error) },
                    );
                }
            }
            const serverClosed = new Promise<void>((resolve) => {
                server.close(() => resolve());
            });
            server.closeAllConnections();
            await serverClosed;
            resolveStopped?.();
        })();
    };
    const startupRequestListener = createDaemonStartupRequestListener({
        getState: () => startupState,
        identity,
        onShutdown: () => stopServer("Shutdown requested through the daemon protocol."),
        token,
    });
    const server = createServer(startupRequestListener);
    const writeServerRegistry = () => {
        const inspectorUrl = getNodeInspectorUrl();
        return writeRegistry(paths.registryPath, {
            ...(inspectorUrl === undefined ? {} : { inspectorUrl }),
            pid: process.pid,
            socketPath,
            startedAt,
        });
    };
    let initialization = Promise.resolve();
    const reportStartupError = (error: unknown) => {
        if (stopping) return;
        const message = errorToMessage(error);
        startupState = { error: message, status: "error" };
        daemonLog.record("error", "daemon_startup_failed", "Rig daemon could not start.", {
            error: message,
        });
    };
    const stopForSigint = () => stopServer("Received SIGINT.");
    const stopForSigterm = () => stopServer("Received SIGTERM.");
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
        process.once("SIGINT", stopForSigint);
        process.once("SIGTERM", stopForSigterm);
        try {
            await chmod(socketPath, 0o600);
            if (stopping) {
                await stopped;
                return;
            }
            await writeServerRegistry();
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
        process.off("SIGINT", stopForSigint);
        process.off("SIGTERM", stopForSigterm);
        await initialization;
        if (mcpToolProvider !== undefined) {
            try {
                await mcpToolProvider.close();
            } catch (error) {
                daemonLog.record(
                    "error",
                    "daemon_mcp_shutdown_failed",
                    "Rig daemon could not close every MCP connection.",
                    { error: errorToMessage(error) },
                );
            }
        }
        try {
            await runHappyLifecycle(async () => {
                const service = happySyncService;
                happySyncService = undefined;
                await service?.close();
            });
        } catch (error) {
            daemonLog.record(
                "error",
                "daemon_happy_shutdown_failed",
                "Rig daemon could not close Happy sync.",
                { error: errorToMessage(error) },
            );
        }
        try {
            store?.close();
        } finally {
            daemonLog.record("info", "daemon_stopped", "Rig daemon stopped.");
            uninstallProcessFailureLogging();
        }
    }

    async function initializeDaemon(): Promise<void> {
        const loadedConfig = await loadConfig({ cwd: process.cwd() });
        if (stopping) return;

        const providerQuotaService = createProviderQuotaService({
            cwd: process.cwd(),
            providers: loadedConfig.config.providers,
        });
        const disabledProviderReasons = await resolveProviderDisabledReasons(
            loadedConfig.config.providers,
            process.env,
        );
        if (stopping) return;
        const availableProviders = disableUnavailableProviders(
            loadedConfig.config.providers,
            disabledProviderReasons,
        );
        const modelCatalog = createModelCatalog({
            cwd: process.cwd(),
            disabledProviderReasons,
            providers: loadedConfig.config.providers,
        });
        mcpToolProvider = new McpClientManager();
        taskDrain = new TrackedTaskDrain();
        const happyModule = await loadHappyIntegration(
            resolveHappyIntegrationMode(
                options.happyIntegration,
                loadedConfig.config.settings.happyIntegration,
            ),
        );
        const happyConfiguration = await happyModule?.importHappyCredentials({
            machineScope: socketPath,
        });
        store = new PersistentSessionStore({
            createRuntime: (options) =>
                createCodingAssistantAgent({
                    ...options,
                    providers: availableProviders,
                }),
            databasePath: paths.databasePath,
            durableGlobalEventQueue: loadedConfig.config.settings.durableGlobalEventQueue,
            mcpToolProvider,
            modelCatalog,
            ...(happyModule === undefined
                ? {}
                : {
                      onSessionAccess: (session) => happySyncService?.attach(session),
                      onSessionEvent: (event, session) => happySyncService?.observe(event, session),
                  }),
            taskDrain,
        });
        if (happyModule !== undefined && happyConfiguration !== undefined) {
            try {
                const service = new happyModule.HappySyncService({
                    configuration: happyConfiguration,
                    createSession: (id, request) =>
                        store!.createWithId(
                            id,
                            configureSessionRequest(request, loadedConfig.config.docker),
                        ),
                    databasePath: paths.databasePath,
                    getSubagents: (sessionId) => store?.listSubagents(sessionId) ?? [],
                    modelCatalog,
                });
                service.start();
                happySyncService = service;
            } catch (error) {
                daemonLog.record(
                    "warning",
                    "daemon_happy_unavailable",
                    "Happy sync is unavailable.",
                    { error: errorToMessage(error) },
                );
            }
        }
        registerRigDebugRoot({
            kind: "daemon",
            paths,
            server,
            store,
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
                ...(happyModule === undefined
                    ? {}
                    : {
                          onReloadHappy: async () => {
                              if (stopping) return false;
                              return runHappyLifecycle(async () => {
                                  if (stopping) return false;
                                  const nextConfiguration =
                                      await happyModule.importHappyCredentials({
                                          machineScope: socketPath,
                                      });
                                  if (stopping || nextConfiguration === undefined) return false;
                                  let next: HappySyncService;
                                  try {
                                      next = new happyModule.HappySyncService({
                                          configuration: nextConfiguration,
                                          createSession: (id, request) =>
                                              store!.createWithId(
                                                  id,
                                                  configureSessionRequest(
                                                      request,
                                                      loadedConfig.config.docker,
                                                  ),
                                              ),
                                          databasePath: paths.databasePath,
                                          getSubagents: (sessionId) =>
                                              store?.listSubagents(sessionId) ?? [],
                                          modelCatalog,
                                      });
                                  } catch (error) {
                                      daemonLog.record(
                                          "error",
                                          "daemon_happy_reload_failed",
                                          "Happy sync could not reload.",
                                          { error: errorToMessage(error) },
                                      );
                                      return false;
                                  }
                                  const previous = happySyncService;
                                  happySyncService = undefined;
                                  try {
                                      await previous?.close();
                                  } catch (error) {
                                      daemonLog.record(
                                          "warning",
                                          "daemon_happy_previous_close_failed",
                                          "The previous Happy sync connection could not close cleanly.",
                                          { error: errorToMessage(error) },
                                      );
                                  }
                                  next.start();
                                  happySyncService = next;
                                  for (const session of store!.loadedSessions()) {
                                      next.attach(session);
                                  }
                                  return true;
                              });
                          },
                      }),
                onStartInspector: async () => {
                    const inspectorUrl = openNodeInspector();
                    await writeServerRegistry();
                    return { inspectorUrl };
                },
                onShutdown: () => stopServer("Shutdown requested through the daemon protocol."),
                store,
                taskDrain,
                token,
            },
            server,
        );
        server.off("request", startupRequestListener);
        daemonLog.record("info", "daemon_ready", "Rig daemon is ready.", {
            databasePath: paths.databasePath,
            socketPath,
        });
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
