import { homedir } from "node:os";
import { join } from "node:path";

export function getCodexAuthPath(
    options: { authFile?: string; env?: NodeJS.ProcessEnv } = {},
): string {
    if (options.authFile?.trim()) return options.authFile;

    const codexHome = (options.env ?? process.env).CODEX_HOME?.trim();
    return join(codexHome || homedir(), codexHome ? "auth.json" : ".codex/auth.json");
}
