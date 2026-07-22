import { randomUUID } from "node:crypto";

import { CodeModeSession } from "./CodeModeSession.js";
import { HostClient } from "./HostClient.js";
import { resolveCodeModeBinary } from "./resolveCodeModeBinary.js";
import type { CodeModeOptions, CodeModeSessionOptions } from "./types.js";

export class CodeMode {
    private readonly client: HostClient;
    private closed = false;
    private readonly pendingSessionIds = new Set<string>();
    private readonly sessions = new Map<string, CodeModeSession>();

    private constructor(options: CodeModeOptions) {
        this.client = new HostClient(
            resolveCodeModeBinary(options.binaryPath),
            options.env,
            options.sandbox ?? "auto",
            async (message, signal) => {
                const session = this.sessions.get(message.sessionId);
                if (session === undefined) {
                    throw new Error(
                        `Code Mode requested a delegate for unknown session ${message.sessionId}.`,
                    );
                }
                return session.handleDelegate(message, signal);
            },
            (sessionId, cellId) => this.sessions.get(sessionId)?.handleCellClosed(cellId),
        );
    }

    static async create(options: CodeModeOptions = {}): Promise<CodeMode> {
        const codeMode = new CodeMode(options);
        await codeMode.client.connect();
        return codeMode;
    }

    async createSession(options: CodeModeSessionOptions = {}): Promise<CodeModeSession> {
        if (this.closed) {
            throw new Error("Code Mode host is closed.");
        }
        const sessionId = options.sessionId ?? `session-${randomUUID()}`;
        if (this.sessions.has(sessionId) || this.pendingSessionIds.has(sessionId)) {
            throw new Error(`Code Mode session ${sessionId} is already open.`);
        }
        this.pendingSessionIds.add(sessionId);
        try {
            const response = await this.client.openSession(sessionId);
            if (response.type !== "session/ready") {
                throw new Error(`Expected session/ready, received ${response.type}.`);
            }
            if (this.closed) {
                await this.client.shutdownSession(sessionId).catch(() => undefined);
                throw new Error("Code Mode host is closed.");
            }
            const session = new CodeModeSession(this.client, sessionId, options, () =>
                this.sessions.delete(sessionId),
            );
            this.sessions.set(sessionId, session);
            return session;
        } finally {
            this.pendingSessionIds.delete(sessionId);
        }
    }

    async close(): Promise<void> {
        if (this.closed) {
            return;
        }
        this.closed = true;
        const sessions = [...this.sessions.values()];
        const results = await Promise.allSettled(sessions.map((session) => session.close()));
        await this.client.close();
        const failure = results.find(
            (result): result is PromiseRejectedResult => result.status === "rejected",
        );
        if (failure !== undefined) {
            throw failure.reason;
        }
    }
}
