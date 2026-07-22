import type { CodeModeHostCommand } from "./CodeModeHostCommand.js";

const SANDBOX_BINARY = "/rig-codemode-codex-host";

export function createLinuxSandboxCommand(
    sandboxExecutable: string,
    binaryPath: string,
    systemPathExists: (path: string) => boolean,
): CodeModeHostCommand {
    const args = [
        "--die-with-parent",
        "--new-session",
        "--unshare-user",
        "--unshare-ipc",
        "--unshare-pid",
        "--unshare-net",
        "--unshare-uts",
        "--unshare-cgroup-try",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
    ];

    for (const runtimePath of ["/lib", "/lib64", "/usr/lib", "/usr/lib64"]) {
        if (systemPathExists(runtimePath)) {
            args.push("--ro-bind", runtimePath, runtimePath);
        }
    }

    args.push(
        "--ro-bind",
        binaryPath,
        SANDBOX_BINARY,
        "--setenv",
        "HOME",
        "/nonexistent",
        "--setenv",
        "TMPDIR",
        "/tmp",
        "--chdir",
        "/",
        "--",
        SANDBOX_BINARY,
    );

    return { args, command: sandboxExecutable, cwd: "/" };
}
