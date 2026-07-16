import type { PermissionMode } from "../permissions/index.js";
import type { PreparedDockerSandbox } from "./prepareDockerSandbox.js";

export function createDockerSandboxCommand(options: {
    command: string;
    commandCwd: string;
    mode: Exclude<PermissionMode, "full_access">;
    runtime: PreparedDockerSandbox;
    shell: string;
    workspaceCwd: string;
}): string[] {
    const command = [
        options.runtime.bwrapPath,
        "--new-session",
        "--die-with-parent",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
        "--bind",
        "/tmp",
        "/tmp",
    ];
    if (options.runtime.homeDirectory !== undefined) {
        command.push("--tmpfs", options.runtime.homeDirectory);
    }
    command.push(
        options.mode === "read_only" ? "--ro-bind" : "--bind",
        options.workspaceCwd,
        options.workspaceCwd,
        "--dev",
        "/dev",
        "--unshare-pid",
        "--unshare-user",
        "--bind",
        "/proc",
        "/proc",
        "--chdir",
        options.commandCwd,
        "--",
        options.runtime.applySeccompPath,
        options.shell,
        "-lc",
        options.command,
    );
    return command;
}
