import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { isPermissionMode } from "../permissions/index.js";
import type { CreateSessionRequest, ModelCatalog } from "../protocol/index.js";
import { createHappySpawnSessionId } from "./createHappySpawnSessionId.js";
import type { HappySpawnSessionRequest, HappySpawnSessionResult } from "./types.js";

export async function handleHappySpawnSession(options: {
    createSession: (id: string, request: CreateSessionRequest) => void;
    machineId: string;
    modelCatalog: ModelCatalog;
    params: unknown;
    signal?: AbortSignal;
    waitForRemoteSession: (localSessionId: string) => Promise<string | undefined>;
}): Promise<HappySpawnSessionResult> {
    try {
        const request = readRequest(options.params);
        options.signal?.throwIfAborted();
        const directory = resolveDirectory(request.directory);
        const directoryStatus = await inspectDirectory(directory);
        options.signal?.throwIfAborted();
        if (directoryStatus === "missing" && request.approvedNewDirectoryCreation !== true) {
            return { directory, type: "requestToApproveDirectoryCreation" };
        }
        if (directoryStatus === "missing") await mkdir(directory, { recursive: true });
        options.signal?.throwIfAborted();
        if (directoryStatus === "not-directory") {
            throw new Error("The selected path is not a directory.");
        }

        const providerId = request.providerId ?? options.modelCatalog.defaultProviderId;
        const modelId = request.modelId ?? options.modelCatalog.defaultModelId;
        const provider = options.modelCatalog.providers.find(
            (candidate) => candidate.providerId === providerId,
        );
        const model = provider?.models.find((candidate) => candidate.id === modelId);
        if (provider === undefined || model === undefined) {
            throw new Error("The selected Rig model is unavailable.");
        }
        const effort = request.effort ?? model.defaultThinkingLevel;
        if (!model.thinkingLevels.includes(effort)) {
            throw new Error("The selected reasoning level is unavailable for this model.");
        }
        const permissionMode = request.permissionMode ?? "auto";
        if (!isPermissionMode(permissionMode)) {
            throw new Error("The selected Rig permission mode is unavailable.");
        }
        const localSessionId = createHappySpawnSessionId(
            options.machineId,
            request.clientRequestId,
        );
        options.signal?.throwIfAborted();
        options.createSession(localSessionId, {
            cwd: directory,
            effort,
            modelId,
            permissionMode,
            providerId,
        });
        const remoteSessionId = await options.waitForRemoteSession(localSessionId);
        if (remoteSessionId === undefined) {
            return {
                clientRequestId: request.clientRequestId,
                retryAfterMs: 2_000,
                type: "pending",
            };
        }
        return { sessionId: remoteSessionId, type: "success" };
    } catch (error) {
        return {
            errorMessage: error instanceof Error ? error.message : "Rig could not start a session.",
            type: "error",
        };
    }
}

function readRequest(value: unknown): HappySpawnSessionRequest {
    if (!isRecord(value) || value.type !== "spawn-in-directory" || value.agent !== "rig") {
        throw new Error("Happy sent an unsupported Rig session request.");
    }
    if (
        typeof value.clientRequestId !== "string" ||
        value.clientRequestId.trim().length === 0 ||
        value.clientRequestId.length > 256
    ) {
        throw new Error("Happy must provide a client request ID.");
    }
    if (
        typeof value.directory !== "string" ||
        value.directory.trim().length === 0 ||
        value.directory.length > 32_768
    ) {
        throw new Error("Happy must provide a session directory.");
    }
    for (const key of ["effort", "modelId", "permissionMode", "providerId"] as const) {
        if (
            value[key] !== undefined &&
            (typeof value[key] !== "string" || value[key].length > 256)
        ) {
            throw new Error(`Happy sent an invalid ${key}.`);
        }
    }
    return value as unknown as HappySpawnSessionRequest;
}

function resolveDirectory(value: string): string {
    const expanded =
        value === "~"
            ? homedir()
            : value.startsWith("~/")
              ? resolve(homedir(), value.slice(2))
              : value;
    if (!expanded.startsWith("/")) throw new Error("The session directory must be absolute.");
    return resolve(expanded);
}

async function inspectDirectory(path: string): Promise<"directory" | "missing" | "not-directory"> {
    try {
        return (await stat(path)).isDirectory() ? "directory" : "not-directory";
    } catch (error) {
        if (isRecord(error) && error.code === "ENOENT") return "missing";
        throw error;
    }
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
