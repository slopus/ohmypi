import { createHash } from "node:crypto";
import {
    chmodSync,
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceManifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const targets = {
    "aarch64-apple-darwin": {
        alias: "@slopus/rig-codemode-codex-darwin-arm64",
        cpu: "arm64",
        os: "darwin",
        tag: "darwin-arm64",
    },
    "x86_64-apple-darwin": {
        alias: "@slopus/rig-codemode-codex-darwin-x64",
        cpu: "x64",
        os: "darwin",
        tag: "darwin-x64",
    },
    "aarch64-unknown-linux-musl": {
        alias: "@slopus/rig-codemode-codex-linux-arm64",
        cpu: "arm64",
        os: "linux",
        tag: "linux-arm64",
    },
    "x86_64-unknown-linux-musl": {
        alias: "@slopus/rig-codemode-codex-linux-x64",
        cpu: "x64",
        os: "linux",
        tag: "linux-x64",
    },
    "aarch64-pc-windows-msvc": {
        alias: "@slopus/rig-codemode-codex-win32-arm64",
        cpu: "arm64",
        os: "win32",
        tag: "win32-arm64",
    },
    "x86_64-pc-windows-msvc": {
        alias: "@slopus/rig-codemode-codex-win32-x64",
        cpu: "x64",
        os: "win32",
        tag: "win32-x64",
    },
};
const sharedFiles = [
    "LICENSE",
    "LICENSE-CODEX",
    "NOTICE-CODEX",
    "README.md",
    "THIRD-PARTY-LICENSES.json",
    "THIRD-PARTY-NOTICES.md",
    "UPSTREAM.md",
];

const [kind, ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs);
const version = args.version ?? sourceManifest.version;
const output = path.resolve(args.output ?? path.join(packageRoot, "artifacts"));
mkdirSync(output, { recursive: true });

if (kind === "root") {
    buildRoot(version, output);
} else if (kind === "platform") {
    buildPlatform(version, output, required(args, "target"), required(args, "binary"));
} else {
    throw new Error(
        "Usage: package.mjs root|platform [--version X] [--output DIR] [--target TRIPLE --binary PATH]",
    );
}

function buildRoot(releaseVersion, outputDirectory) {
    run("pnpm", ["build"]);
    const stage = createStage("root");
    cpSync(path.join(packageRoot, "dist"), path.join(stage, "dist"), { recursive: true });
    copySharedFiles(stage);
    const optionalDependencies = Object.values(targets).reduce((dependencies, target) => {
        dependencies[target.alias] = `npm:${sourceManifest.name}@${releaseVersion}-${target.tag}`;
        return dependencies;
    }, {});
    writeManifest(stage, {
        ...publishableManifest(releaseVersion),
        files: ["dist", ...sharedFiles],
        optionalDependencies,
    });
    pack(stage, outputDirectory);
}

function buildPlatform(releaseVersion, outputDirectory, targetName, binaryName) {
    const target = targets[targetName];
    if (target === undefined) {
        throw new Error(`Unsupported target: ${targetName}`);
    }
    const binary = path.resolve(binaryName);
    if (!existsSync(binary)) {
        throw new Error(`Native binary does not exist: ${binary}`);
    }
    const stage = createStage(target.tag);
    copySharedFiles(stage);
    const executableName =
        target.os === "win32" ? "codex-code-mode-host.exe" : "codex-code-mode-host";
    const executable = path.join(stage, "vendor", targetName, "bin", executableName);
    mkdirSync(path.dirname(executable), { recursive: true });
    copyFileSync(binary, executable);
    if (target.os !== "win32") {
        chmodSync(executable, 0o755);
    }
    const digest = createHash("sha256").update(readFileSync(executable)).digest("hex");
    writeFileSync(
        path.join(stage, "SHA256SUMS"),
        `${digest}  vendor/${targetName}/bin/${executableName}\n`,
    );
    writeManifest(stage, {
        name: sourceManifest.name,
        version: `${releaseVersion}-${target.tag}`,
        description: `${sourceManifest.description} Native binary for ${target.tag}.`,
        license: sourceManifest.license,
        repository: sourceManifest.repository,
        engines: sourceManifest.engines,
        os: [target.os],
        cpu: [target.cpu],
        bin: { "codex-code-mode-host": `vendor/${targetName}/bin/${executableName}` },
        files: ["vendor", "SHA256SUMS", ...sharedFiles],
        publishConfig: { access: "public", tag: "platform" },
    });
    pack(stage, outputDirectory);
}

function copySharedFiles(stage) {
    for (const file of sharedFiles) {
        const source = path.join(packageRoot, file);
        if (!existsSync(source)) {
            throw new Error(`Required package file does not exist: ${source}`);
        }
        copyFileSync(source, path.join(stage, file));
    }
}

function createStage(label) {
    return mkdtempSync(path.join(tmpdir(), `codemode-${label}-`));
}

function pack(stage, outputDirectory) {
    run("pnpm", ["pack", "--pack-destination", outputDirectory], stage);
}

function parseArgs(values) {
    const parsed = {};
    for (let index = 0; index < values.length; index += 2) {
        const key = values[index];
        const value = values[index + 1];
        if (key === undefined || !key.startsWith("--") || value === undefined) {
            throw new Error(`Invalid package argument near ${String(key)}.`);
        }
        parsed[key.slice(2)] = value;
    }
    return parsed;
}

function publishableManifest(releaseVersion) {
    const { devDependencies: _devDependencies, scripts: _scripts, ...manifest } = sourceManifest;
    return { ...manifest, version: releaseVersion };
}

function required(values, key) {
    const value = values[key];
    if (value === undefined) {
        throw new Error(`Missing --${key}.`);
    }
    return value;
}

function run(command, commandArgs, cwd = packageRoot) {
    const result = spawnSync(command, commandArgs, { cwd, encoding: "utf8", stdio: "inherit" });
    if (result.error !== undefined) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(
            `${command} ${commandArgs.join(" ")} exited with ${String(result.status)}.`,
        );
    }
}

function writeManifest(stage, manifest) {
    writeFileSync(path.join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
