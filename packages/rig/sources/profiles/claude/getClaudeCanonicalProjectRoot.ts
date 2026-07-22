import { basename, dirname, resolve } from "node:path";

import type { BashContext } from "../../agent/context/BashContext.js";

export async function getClaudeCanonicalProjectRoot(
    bash: BashContext,
    cwd: string,
    fallbackRoot: string,
): Promise<string> {
    try {
        const result = await bash.run({
            command: "git rev-parse --path-format=absolute --git-common-dir",
            cwd,
            maxOutputBytes: 10_000,
            timeoutMs: 2_000,
        });
        if (result.exitCode !== 0 || result.timedOut) return fallbackRoot;

        const commonDirectory = resolve(cwd, result.stdout.trim());
        if (basename(commonDirectory) !== ".git") return fallbackRoot;
        return dirname(commonDirectory).normalize("NFC");
    } catch {
        return fallbackRoot;
    }
}
