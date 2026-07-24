import { appendFileSync } from "node:fs";

import { readPackageVersion } from "../readPackageVersion.js";

export type DaemonLogLevel = "error" | "info" | "warning";

export interface DaemonLogOptions {
    now?: () => number;
    path: string;
    pid?: number;
    version?: string;
    write?: (path: string, line: string) => void;
}

export class DaemonLog {
    readonly path: string;

    #now: () => number;
    #pid: number;
    #version: string;
    #write: (path: string, line: string) => void;

    constructor(options: DaemonLogOptions) {
        this.path = options.path;
        this.#now = options.now ?? Date.now;
        this.#pid = options.pid ?? process.pid;
        this.#version = options.version ?? readPackageVersion();
        this.#write =
            options.write ??
            ((path, line) => {
                appendFileSync(path, line, { encoding: "utf8", mode: 0o600 });
            });
    }

    record(
        level: DaemonLogLevel,
        event: string,
        message: string,
        details: Readonly<Record<string, boolean | number | string | undefined>> = {},
    ): void {
        try {
            this.#write(
                this.path,
                `${JSON.stringify({
                    ...details,
                    event,
                    level,
                    message,
                    pid: this.#pid,
                    timestamp: new Date(this.#now()).toISOString(),
                    version: this.#version,
                })}\n`,
            );
        } catch {
            // Logging must never turn a healthy daemon action into a failure.
        }
    }
}
