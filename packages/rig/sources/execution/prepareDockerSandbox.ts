import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, posix, resolve } from "node:path";

import type Dockerode from "dockerode";

import { createTarBuffer } from "./createTarBuffer.js";
import { runDockerExec } from "./runDockerExec.js";

const require = createRequire(import.meta.url);

export interface PreparedDockerSandbox {
    applySeccompPath: string;
    bwrapPath: string;
    homeDirectory?: string;
}

export async function prepareDockerSandbox(
    container: Dockerode.Container,
    contextId: string,
): Promise<PreparedDockerSandbox> {
    const metadata = await runDockerExec(container, [
        "/bin/sh",
        "-c",
        'bwrap=$(command -v bwrap) || exit 20; bwrap=$(readlink -f "$bwrap") || exit 21; architecture=$(uname -m) || exit 22; home=; if [ -n "${HOME:-}" ]; then home=$(readlink -f "$HOME") || exit 23; fi; printf "%s\\0%s\\0%s" "$bwrap" "$architecture" "$home"',
    ]);
    if (metadata.exitCode !== 0) throw dockerSandboxRequirementsError(metadata.stderr);

    const [bwrapPath, architecture, homeDirectory] = metadata.stdout.toString("utf8").split("\0");
    if (bwrapPath === undefined || !posix.isAbsolute(bwrapPath) || architecture === undefined) {
        throw dockerSandboxRequirementsError(metadata.stderr);
    }

    const probe = await runDockerExec(container, [
        bwrapPath,
        "--new-session",
        "--die-with-parent",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--unshare-pid",
        "--unshare-user",
        "--bind",
        "/proc",
        "/proc",
        "--",
        "/bin/sh",
        "-c",
        ":",
    ]);
    if (probe.exitCode !== 0) throw dockerSandboxRequirementsError(probe.stderr);

    const architectureDirectory = dockerSandboxArchitectureDirectory(architecture);
    const sandboxRuntimeEntry = require.resolve("@anthropic-ai/sandbox-runtime");
    const applySeccomp = await readFile(
        resolve(
            dirname(sandboxRuntimeEntry),
            "..",
            "vendor",
            "seccomp",
            architectureDirectory,
            "apply-seccomp",
        ),
    );
    const runtimeName = `rig-sandbox-${contextId}`;
    const runtimeDirectory = posix.join("/tmp", runtimeName);
    await container.putArchive(
        await createTarBuffer(posix.join(runtimeName, "apply-seccomp"), applySeccomp, 0o755),
        { path: "/tmp" },
    );

    return {
        applySeccompPath: posix.join(runtimeDirectory, "apply-seccomp"),
        bwrapPath,
        ...(homeDirectory !== undefined && posix.isAbsolute(homeDirectory) && homeDirectory !== "/"
            ? { homeDirectory: posix.normalize(homeDirectory) }
            : {}),
    };
}

function dockerSandboxArchitectureDirectory(architecture: string): "arm64" | "x64" {
    if (architecture === "aarch64" || architecture === "arm64") return "arm64";
    if (architecture === "amd64" || architecture === "x86_64") return "x64";
    throw new Error(
        `Restricted Docker commands are not supported on container architecture '${architecture}'. Use an arm64 or x64 image.`,
    );
}

function dockerSandboxRequirementsError(stderr: Buffer): Error {
    const detail = stderr.toString("utf8").trim();
    return new Error(
        "Restricted Docker commands require Bubblewrap and nested user namespaces. Install bubblewrap in the image; when connecting to an existing container, start it with '--security-opt seccomp=unconfined'." +
            (detail === "" ? "" : ` Docker reported: ${detail}`),
    );
}
