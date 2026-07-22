import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PLATFORM_TARGETS, type PlatformKey } from "./platform.js";

const require = createRequire(import.meta.url);

export function resolveCodeModeBinary(binaryPath?: string): string {
    if (binaryPath !== undefined) {
        if (!existsSync(binaryPath)) {
            throw new Error(`Code Mode binary does not exist: ${binaryPath}`);
        }
        return path.resolve(binaryPath);
    }

    const key = `${process.platform}-${process.arch}` as PlatformKey;
    const platform = PLATFORM_TARGETS[key];
    if (platform === undefined) {
        throw new Error(`Code Mode does not support ${process.platform} ${process.arch}.`);
    }

    const executable =
        process.platform === "win32" ? "codex-code-mode-host.exe" : "codex-code-mode-host";
    try {
        const manifest = require.resolve(`${platform.alias}/package.json`);
        const installed = path.join(
            path.dirname(manifest),
            "vendor",
            platform.target,
            "bin",
            executable,
        );
        if (existsSync(installed)) {
            return installed;
        }
    } catch {
        // Fall through to repository-local build locations.
    }

    const packageRoot = fileURLToPath(new URL("../", import.meta.url));
    const localCandidates = [
        path.join(packageRoot, "native", "target", platform.target, "release", executable),
        path.join(packageRoot, "native", "target", "release", executable),
        path.join(packageRoot, "native", "target", platform.target, "debug", executable),
        path.join(packageRoot, "native", "target", "debug", executable),
    ];
    const local = localCandidates.find((candidate) => existsSync(candidate));
    if (local !== undefined) {
        return local;
    }

    throw new Error(
        `The optional binary package ${platform.alias} is missing. Reinstall @slopus/rig-codemode-codex, ` +
            "or build it with pnpm --filter @slopus/rig-codemode-codex build:native.",
    );
}
