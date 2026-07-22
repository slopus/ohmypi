import type { CodeModeSandboxMode } from "./types.js";

export interface CodeModeHostCommand {
    readonly args: readonly string[];
    readonly command: string;
    readonly cwd?: string;
}

export interface CreateCodeModeHostCommandOptions {
    readonly binaryPath: string;
    readonly env: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
    readonly resolveSandboxExecutable?: (
        platform: NodeJS.Platform,
        env: NodeJS.ProcessEnv,
    ) => string | undefined;
    readonly sandbox: CodeModeSandboxMode;
    readonly systemPathExists?: (path: string) => boolean;
}
