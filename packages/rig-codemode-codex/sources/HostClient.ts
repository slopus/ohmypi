import { spawn } from "node:child_process";

import { Deferred } from "./Deferred.js";
import { FramedProcess } from "./FramedProcess.js";
import { createCodeModeHostCommand } from "./createCodeModeHostCommand.js";
import type {
    HostMessage,
    HostOperationResponse,
    WireRuntimeResponse,
    WireWaitOutcome,
} from "./protocol.js";
import type { CodeModeSandboxMode, JsonValue } from "./types.js";

type DelegateRequestMessage = Extract<HostMessage, { readonly type: "delegate/request" }>;
type DelegateResponse =
    | { readonly type: "notification/delivered" }
    | { readonly type: "tool/result"; readonly result: JsonValue };

interface PendingOperation {
    readonly deferred: Deferred<HostOperationResponse>;
    readonly onResponse?: (response: HostOperationResponse) => void;
}

export class HostClient {
    private closed = false;
    private readonly delegates = new Map<number, AbortController>();
    private readonly handshake = new Deferred<void>();
    private nextRequestId = 1;
    private readonly pendingInitial = new Map<number, Deferred<WireRuntimeResponse>>();
    private readonly pendingOperations = new Map<number, PendingOperation>();
    private readonly process: FramedProcess;

    constructor(
        binaryPath: string,
        env: NodeJS.ProcessEnv | undefined,
        sandbox: CodeModeSandboxMode,
        private readonly onDelegate: (
            message: DelegateRequestMessage,
            signal: AbortSignal,
        ) => Promise<DelegateResponse>,
        private readonly onCellClosed: (sessionId: string, cellId: string) => void,
    ) {
        const childEnv = env === undefined ? process.env : { ...process.env, ...env };
        const command = createCodeModeHostCommand({ binaryPath, env: childEnv, sandbox });
        const child = spawn(command.command, command.args, {
            ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
            env: childEnv,
            stdio: "pipe",
            windowsHide: true,
        });
        this.process = new FramedProcess(
            child,
            (message) => this.receive(message),
            (error) => this.fail(error),
        );
    }

    async connect(): Promise<void> {
        const timeout = setTimeout(
            () => this.handshake.reject(new Error("Timed out connecting to the Code Mode host.")),
            10_000,
        );
        timeout.unref();
        try {
            await this.process.send({
                type: "connection/hello",
                supportedVersions: [1],
                requiredCapabilities: [],
                optionalCapabilities: [],
            });
            await this.handshake.promise;
        } catch (error) {
            this.process.kill();
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    openSession(sessionId: string): Promise<HostOperationResponse> {
        return this.operation({ method: "session/open", sessionId });
    }

    async execute(
        sessionId: string,
        request: Readonly<Record<string, unknown>>,
        onStarted: (cellId: string) => void,
        signal?: AbortSignal,
    ): Promise<WireRuntimeResponse> {
        this.throwIfAborted(signal);
        const id = this.allocateRequestId();
        const operation = new Deferred<HostOperationResponse>();
        const initial = new Deferred<WireRuntimeResponse>();
        this.pendingOperations.set(id, {
            deferred: operation,
            onResponse: (response) => {
                if (response.type === "execution/started") {
                    onStarted(response.cellId);
                }
            },
        });
        this.pendingInitial.set(id, initial);
        let removeAbort: () => void = () => undefined;
        try {
            await this.process.send({
                type: "operation/request",
                id,
                request: { method: "session/execute", sessionId, request },
            });
            removeAbort = this.attachAbort(id, signal);
            const response = await operation.promise;
            if (response.type !== "execution/started") {
                throw new Error(`Expected execution/started, received ${response.type}.`);
            }
            return await initial.promise;
        } catch (error) {
            this.pendingOperations.delete(id);
            this.pendingInitial.delete(id);
            throw error;
        } finally {
            removeAbort();
        }
    }

    async wait(
        sessionId: string,
        cellId: string,
        yieldTimeMs: number,
        signal?: AbortSignal,
    ): Promise<WireWaitOutcome> {
        const response = await this.operation(
            {
                method: "session/wait",
                sessionId,
                request: { cell_id: cellId, yield_time_ms: yieldTimeMs },
            },
            signal,
        );
        if (response.type !== "wait/completed") {
            throw new Error(`Expected wait/completed, received ${response.type}.`);
        }
        return response.outcome;
    }

    async terminate(sessionId: string, cellId: string): Promise<WireWaitOutcome> {
        const response = await this.operation({ method: "session/terminate", sessionId, cellId });
        if (response.type !== "wait/completed") {
            throw new Error(`Expected wait/completed, received ${response.type}.`);
        }
        return response.outcome;
    }

    shutdownSession(sessionId: string): Promise<HostOperationResponse> {
        return this.operation({ method: "session/shutdown", sessionId });
    }

    async close(): Promise<void> {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.fail(new Error("Code Mode host client closed."));
        await this.process.close();
    }

    private allocateRequestId(): number {
        if (!Number.isSafeInteger(this.nextRequestId)) {
            throw new Error("Code Mode request IDs exhausted the JavaScript safe integer range.");
        }
        return this.nextRequestId++;
    }

    private attachAbort(id: number, signal: AbortSignal | undefined): () => void {
        if (signal === undefined) {
            return () => undefined;
        }
        const cancel = () => {
            void this.process.send({ type: "operation/cancel", id }).catch(() => undefined);
        };
        if (signal.aborted) {
            cancel();
        } else {
            signal.addEventListener("abort", cancel, { once: true });
        }
        return () => signal.removeEventListener("abort", cancel);
    }

    private fail(error: Error): void {
        this.handshake.reject(error);
        for (const pending of this.pendingOperations.values()) {
            pending.deferred.reject(error);
        }
        for (const pending of this.pendingInitial.values()) {
            pending.reject(error);
        }
        this.pendingOperations.clear();
        this.pendingInitial.clear();
        for (const controller of this.delegates.values()) {
            controller.abort(error);
        }
        this.delegates.clear();
    }

    private async operation(
        request: Readonly<Record<string, unknown>>,
        signal?: AbortSignal,
    ): Promise<HostOperationResponse> {
        this.throwIfAborted(signal);
        const id = this.allocateRequestId();
        const deferred = new Deferred<HostOperationResponse>();
        this.pendingOperations.set(id, { deferred });
        let removeAbort: () => void = () => undefined;
        try {
            await this.process.send({ type: "operation/request", id, request });
            removeAbort = this.attachAbort(id, signal);
            return await deferred.promise;
        } finally {
            removeAbort();
            this.pendingOperations.delete(id);
        }
    }

    private throwIfAborted(signal: AbortSignal | undefined): void {
        if (signal?.aborted === true) {
            throw signal.reason instanceof Error
                ? signal.reason
                : new DOMException("Code Mode operation aborted.", "AbortError");
        }
    }

    private receive(message: HostMessage): void {
        switch (message.type) {
            case "connection/ready":
                if (message.selectedVersion !== 1) {
                    this.handshake.reject(
                        new Error(
                            `Unsupported Code Mode protocol version ${String(message.selectedVersion)}.`,
                        ),
                    );
                } else {
                    this.handshake.resolve();
                }
                break;
            case "connection/rejected":
                this.handshake.reject(
                    new Error(
                        `Code Mode host rejected the connection: ${JSON.stringify(message.reason)}`,
                    ),
                );
                break;
            case "operation/response":
                this.receiveOperation(message.id, message.result);
                break;
            case "execute/initialResponse":
                this.receiveInitial(message.id, message.result);
                break;
            case "delegate/request":
                this.receiveDelegate(message);
                break;
            case "delegate/cancel":
                this.delegates
                    .get(message.id)
                    ?.abort(new Error("Code Mode delegate call cancelled."));
                this.delegates.delete(message.id);
                break;
            case "cell/closed":
                this.onCellClosed(message.sessionId, message.cellId);
                break;
        }
    }

    private receiveOperation(
        id: number,
        result: Extract<HostMessage, { type: "operation/response" }>["result"],
    ): void {
        const pending = this.pendingOperations.get(id);
        if (pending === undefined) {
            throw new Error(`Received a response for unknown Code Mode request ${String(id)}.`);
        }
        this.pendingOperations.delete(id);
        if (result.status === "error") {
            pending.deferred.reject(new Error(result.message));
        } else {
            pending.onResponse?.(result.value);
            pending.deferred.resolve(result.value);
        }
    }

    private receiveInitial(
        id: number,
        result: Extract<HostMessage, { type: "execute/initialResponse" }>["result"],
    ): void {
        const pending = this.pendingInitial.get(id);
        if (pending === undefined) {
            throw new Error(
                `Received an initial response for unknown Code Mode request ${String(id)}.`,
            );
        }
        this.pendingInitial.delete(id);
        if (result.status === "error") {
            pending.reject(new Error(result.message));
        } else {
            pending.resolve(result.value);
        }
    }

    private receiveDelegate(message: DelegateRequestMessage): void {
        const controller = new AbortController();
        this.delegates.set(message.id, controller);
        void this.onDelegate(message, controller.signal)
            .then((value) =>
                controller.signal.aborted
                    ? undefined
                    : this.process.send({
                          type: "delegate/response",
                          id: message.id,
                          result: { status: "ok", value },
                      }),
            )
            .catch((error: unknown) =>
                controller.signal.aborted
                    ? undefined
                    : this.process.send({
                          type: "delegate/response",
                          id: message.id,
                          result: {
                              status: "error",
                              message: error instanceof Error ? error.message : String(error),
                          },
                      }),
            )
            .finally(() => this.delegates.delete(message.id))
            .catch(() => undefined);
    }
}
