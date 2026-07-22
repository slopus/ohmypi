import { existsSync } from "node:fs";

import type {
    CodeModeHostCommand,
    CreateCodeModeHostCommandOptions,
} from "./CodeModeHostCommand.js";
import { createLinuxSandboxCommand } from "./createLinuxSandboxCommand.js";
import { createMacOsSandboxCommand } from "./createMacOsSandboxCommand.js";
import { resolveCodeModeSandboxExecutable } from "./resolveCodeModeSandboxExecutable.js";

export function createCodeModeHostCommand({
    binaryPath,
    env,
    platform = process.platform,
    resolveSandboxExecutable = resolveCodeModeSandboxExecutable,
    sandbox,
    systemPathExists = existsSync,
}: CreateCodeModeHostCommandOptions): CodeModeHostCommand {
    if (sandbox === "disabled") {
        return { args: [], command: binaryPath };
    }

    const sandboxExecutable = resolveSandboxExecutable(platform, env);
    if (sandboxExecutable !== undefined && platform === "darwin") {
        return createMacOsSandboxCommand(sandboxExecutable, binaryPath);
    }
    if (sandboxExecutable !== undefined && platform === "linux") {
        return createLinuxSandboxCommand(sandboxExecutable, binaryPath, systemPathExists);
    }
    if (sandbox === "required") {
        throw new Error(
            `Code Mode system sandbox is required but unavailable on ${platform}. ` +
                "Install Bubblewrap on Linux or use macOS sandbox-exec.",
        );
    }
    return { args: [], command: binaryPath };
}
