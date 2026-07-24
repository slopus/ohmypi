import { describe, expect, it, vi } from "vitest";

import { DaemonLog } from "./DaemonLog.js";
import { installDaemonProcessFailureLogging } from "./installDaemonProcessFailureLogging.js";

describe("DaemonLog", () => {
    it("writes timestamped JSON lines with daemon identity and event details", () => {
        const lines: string[] = [];
        const log = new DaemonLog({
            now: () => Date.parse("2026-07-24T07:30:00.000Z"),
            path: "/state/server.log",
            pid: 4321,
            version: "0.0.46",
            write: (_path, line) => lines.push(line),
        });

        log.record("info", "daemon_starting", "Rig daemon is starting.", {
            databasePath: "/home/tester/.rig/sessions.sqlite",
            socketPath: "/tmp/rig-501/server.sock",
        });

        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0]!)).toEqual({
            databasePath: "/home/tester/.rig/sessions.sqlite",
            event: "daemon_starting",
            level: "info",
            message: "Rig daemon is starting.",
            pid: 4321,
            socketPath: "/tmp/rig-501/server.sock",
            timestamp: "2026-07-24T07:30:00.000Z",
            version: "0.0.46",
        });
        expect(lines[0]).toMatch(/\n$/u);
    });

    it("records fatal process failures without taking ownership of process termination", () => {
        const lines: string[] = [];
        const log = new DaemonLog({
            now: () => Date.parse("2026-07-24T07:31:00.000Z"),
            path: "/state/server.log",
            pid: 4321,
            version: "0.0.46",
            write: (_path, line) => lines.push(line),
        });
        const processEvents = {
            listener: undefined as
                | ((error: Error, origin: NodeJS.UncaughtExceptionOrigin) => void)
                | undefined,
            off: vi.fn(),
            on: vi.fn(
                (
                    _event: "uncaughtExceptionMonitor",
                    listener: (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => void,
                ) => {
                    processEvents.listener = listener;
                },
            ),
        };

        const uninstall = installDaemonProcessFailureLogging(log, processEvents);
        processEvents.listener?.(
            new Error("cannot send on a closed WebSocket"),
            "unhandledRejection",
        );
        uninstall();

        const record = JSON.parse(lines[0]!) as Record<string, unknown>;
        expect(record).toMatchObject({
            errorMessage: "cannot send on a closed WebSocket",
            errorName: "Error",
            event: "daemon_fatal_error",
            level: "error",
            message: "Rig daemon is terminating after an unhandled rejection.",
            origin: "unhandledRejection",
        });
        expect(record.errorStack).toContain("cannot send on a closed WebSocket");
        expect(processEvents.on).toHaveBeenCalledOnce();
        expect(processEvents.off).toHaveBeenCalledWith(
            "uncaughtExceptionMonitor",
            processEvents.listener,
        );
    });

    it("does not turn a logging failure into a daemon failure", () => {
        const log = new DaemonLog({
            path: "/unwritable/server.log",
            write: () => {
                throw new Error("disk unavailable");
            },
        });

        expect(() =>
            log.record("error", "daemon_startup_failed", "Rig daemon could not start."),
        ).not.toThrow();
    });
});
