import type { RequestListener } from "node:http";

import type { DaemonIdentity, HealthResponse, ShutdownServerResponse } from "../protocol/index.js";
import { isAuthorizedProtocolRequest } from "./isAuthorizedProtocolRequest.js";
import { sendJson } from "./sendJson.js";

export interface DaemonStartupState {
    error?: string;
    status: "error" | "starting";
}

export interface CreateDaemonStartupRequestListenerOptions {
    getState: () => DaemonStartupState;
    identity: DaemonIdentity;
    onShutdown: () => void;
    token: string;
}

export function createDaemonStartupRequestListener(
    options: CreateDaemonStartupRequestListenerOptions,
): RequestListener {
    return (request, response) => {
        if (!isAuthorizedProtocolRequest(request, options.token)) {
            sendJson(response, 401, { error: "Unauthorized" });
            return;
        }

        const url = new URL(request.url ?? "/", "http://unix");
        if (request.method === "GET" && url.pathname === "/health") {
            const state = options.getState();
            const health: HealthResponse =
                state.status === "error"
                    ? {
                          error: state.error ?? "The local daemon could not start.",
                          healthy: false,
                          identity: options.identity,
                          ready: false,
                          status: "error",
                      }
                    : {
                          healthy: true,
                          identity: options.identity,
                          ready: false,
                          status: "starting",
                      };
            sendJson<HealthResponse>(response, 200, health);
            return;
        }

        if (request.method === "POST" && url.pathname === "/shutdown") {
            sendJson<ShutdownServerResponse>(response, 202, {
                pid: process.pid,
                shuttingDown: true,
            });
            setImmediate(options.onShutdown);
            return;
        }

        sendJson(response, 503, {
            error:
                options.getState().status === "error"
                    ? "The local daemon could not start. Check its health status for details."
                    : "The local daemon is still starting.",
        });
    };
}
