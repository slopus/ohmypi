import { accessSync, constants, statSync } from "node:fs";

export function resolveCodeModeSandboxExecutable(
    platform: NodeJS.Platform,
    _env: NodeJS.ProcessEnv,
): string | undefined {
    if (platform === "darwin") {
        const sandboxExec = "/usr/bin/sandbox-exec";
        try {
            accessSync(sandboxExec, constants.X_OK);
            return statSync(sandboxExec).isFile() ? sandboxExec : undefined;
        } catch {
            return undefined;
        }
    }
    if (platform === "linux") {
        for (const bubblewrap of ["/usr/bin/bwrap", "/bin/bwrap", "/usr/local/bin/bwrap"]) {
            try {
                accessSync(bubblewrap, constants.X_OK);
                if (statSync(bubblewrap).isFile()) {
                    return bubblewrap;
                }
            } catch {
                // Continue through trusted system installation paths.
            }
        }
    }
    return undefined;
}
