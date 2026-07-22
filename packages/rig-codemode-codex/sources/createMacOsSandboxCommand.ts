import type { CodeModeHostCommand } from "./CodeModeHostCommand.js";
import { createMacOsSandboxProfile } from "./createMacOsSandboxProfile.js";

export function createMacOsSandboxCommand(
    sandboxExecutable: string,
    binaryPath: string,
): CodeModeHostCommand {
    return {
        args: ["-p", createMacOsSandboxProfile(binaryPath), binaryPath],
        command: sandboxExecutable,
        cwd: "/",
    };
}
