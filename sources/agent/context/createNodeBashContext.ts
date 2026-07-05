import type { NativeProxessManager } from "../../processes/index.js";
import type { BashContext } from "./BashContext.js";

export interface CreateNodeBashContextOptions {
    cwd: string;
    processManager: NativeProxessManager;
}

export function createNodeBashContext(options: CreateNodeBashContextOptions): BashContext {
    return {
        cwd: options.cwd,
        async run(runOptions) {
            const processRunOptions: Parameters<NativeProxessManager["run"]>[0] = {
                command: runOptions.command,
                cwd: runOptions.cwd ?? options.cwd,
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
