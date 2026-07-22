import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { assertJsonValue } from "./assertJsonValue.js";
import { MAX_FRAME_BYTES, type ClientMessage, type HostMessage } from "./protocol.js";

const MAX_STDERR_BYTES = 64 * 1024;

export class FramedProcess {
    private buffer = Buffer.alloc(0);
    private closed = false;
    private readonly exitPromise: Promise<void>;
    private failure: Error | undefined;
    private stderr = Buffer.alloc(0);
    private writeTail = Promise.resolve();

    constructor(
        private readonly child: ChildProcessWithoutNullStreams,
        private readonly onMessage: (message: HostMessage) => void,
        private readonly onFailure: (error: Error) => void,
    ) {
        this.child.stdout.on("data", (chunk: Buffer) => this.read(chunk));
        this.child.stderr.on("data", (chunk: Buffer) => this.readStderr(chunk));
        this.child.stdin.on("error", (error) => this.fail(error));
        this.child.stdout.on("error", (error) => this.fail(error));
        this.child.stderr.on("error", (error) => this.fail(error));
        this.child.once("error", (error) => this.fail(error));
        this.exitPromise = new Promise((resolve) => {
            this.child.once("exit", (code, signal) => {
                if (!this.closed) {
                    const suffix =
                        this.stderr.length === 0 ? "" : `\n${this.stderr.toString("utf8")}`;
                    this.fail(
                        new Error(
                            signal === null
                                ? `Code Mode host exited with code ${String(code)}.${suffix}`
                                : `Code Mode host exited from signal ${signal}.${suffix}`,
                        ),
                    );
                }
                resolve();
            });
        });
    }

    send(message: ClientMessage): Promise<void> {
        if (this.failure !== undefined) {
            return Promise.reject(this.failure);
        }
        assertJsonValue(message);
        const payload = Buffer.from(JSON.stringify(message), "utf8");
        if (payload.length > MAX_FRAME_BYTES) {
            return Promise.reject(
                new Error(`Code Mode frame exceeds ${String(MAX_FRAME_BYTES)} bytes.`),
            );
        }
        const header = Buffer.allocUnsafe(4);
        header.writeUInt32LE(payload.length);
        const frame = Buffer.concat([header, payload]);
        const sent = this.writeTail.then(
            () =>
                new Promise<void>((resolve, reject) => {
                    this.child.stdin.write(frame, (error) => {
                        if (error === null || error === undefined) {
                            resolve();
                        } else {
                            reject(error);
                        }
                    });
                }),
        );
        this.writeTail = sent.catch(() => undefined);
        return sent;
    }

    async close(): Promise<void> {
        if (this.closed) {
            return this.exitPromise;
        }
        this.closed = true;
        const timeout = setTimeout(() => this.child.kill("SIGKILL"), 6_000);
        timeout.unref();
        try {
            await this.writeTail;
            this.child.stdin.end();
            await this.exitPromise;
        } catch (error) {
            this.child.kill("SIGKILL");
            await this.exitPromise;
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    kill(): void {
        this.child.kill();
    }

    private fail(error: Error): void {
        if (this.failure !== undefined || this.closed) {
            return;
        }
        this.failure = error;
        this.onFailure(error);
        this.child.kill("SIGKILL");
    }

    private read(chunk: Buffer): void {
        if (this.failure !== undefined) {
            return;
        }
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 4) {
            const length = this.buffer.readUInt32LE(0);
            if (length > MAX_FRAME_BYTES) {
                this.fail(new Error(`Code Mode frame exceeds ${String(MAX_FRAME_BYTES)} bytes.`));
                return;
            }
            if (this.buffer.length < length + 4) {
                return;
            }
            const payload = this.buffer.subarray(4, length + 4);
            this.buffer = this.buffer.subarray(length + 4);
            try {
                this.onMessage(JSON.parse(payload.toString("utf8")) as HostMessage);
            } catch (error) {
                this.fail(error instanceof Error ? error : new Error(String(error)));
                return;
            }
        }
    }

    private readStderr(chunk: Buffer): void {
        this.stderr = Buffer.concat([this.stderr, chunk]);
        if (this.stderr.length > MAX_STDERR_BYTES) {
            this.stderr = this.stderr.subarray(this.stderr.length - MAX_STDERR_BYTES);
        }
    }
}
