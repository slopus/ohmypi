import { isAbsolute, resolve } from "node:path";

import type { NativeProxessManager } from "../../processes/index.js";
import type { PermissionContext } from "../../permissions/index.js";
import type { BashContext } from "./BashContext.js";
import { createSandboxedCommand } from "./createSandboxedCommand.js";

export interface CreateNodeBashContextOptions {
    cwd: string;
    processManager: NativeProxessManager;
    permissions: PermissionContext;
}

export function createNodeBashContext(options: CreateNodeBashContextOptions): BashContext {
    return {
        cwd: options.cwd,
        async run(runOptions) {
            const cwd =
                runOptions.cwd === undefined
                    ? options.cwd
                    : isAbsolute(runOptions.cwd)
                      ? runOptions.cwd
                      : resolve(options.cwd, runOptions.cwd);
            const command = await createSandboxedCommand({
                command: runOptions.command,
                cwd: options.cwd,
                mode: options.permissions.mode,
            });
            const processRunOptions: Parameters<NativeProxessManager["run"]>[0] = {
                command,
                cwd,
                timeoutMs: runOptions.timeoutMs ?? 120_000,
                maxOutputBytes: runOptions.maxOutputBytes ?? 512_000,
            };
            if (runOptions.signal !== undefined) {
                processRunOptions.signal = runOptions.signal;
            }

            const result = await options.processManager.run(processRunOptions);
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                timedOut: result.timedOut,
            };
        },
    };
}
