import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
    "cargo",
    [
        "+1.95.0",
        "metadata",
        "--manifest-path",
        path.join(packageRoot, "native", "Cargo.toml"),
        "--locked",
        "--format-version",
        "1",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (result.error !== undefined) {
    throw result.error;
}
if (result.status !== 0) {
    throw new Error(result.stderr);
}

const metadata = JSON.parse(result.stdout);
const packages = new Map(metadata.packages.map((entry) => [entry.id, entry]));
const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
const root = metadata.packages.find(
    (entry) => entry.name === "codex-code-mode-host" && entry.source === null,
);
if (root === undefined) {
    throw new Error("Could not locate codex-code-mode-host in Cargo metadata.");
}

const included = new Set();
const queue = [root.id];
while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || included.has(id)) {
        continue;
    }
    included.add(id);
    const node = nodes.get(id);
    if (node === undefined) {
        continue;
    }
    for (const dependency of node.deps) {
        if (dependency.dep_kinds.some((kind) => kind.kind === null || kind.kind === "build")) {
            queue.push(dependency.pkg);
        }
    }
}

const inventory = [...included]
    .map((id) => packages.get(id))
    .filter((entry) => entry !== undefined && entry.source !== null)
    .map((entry) => ({
        name: entry.name,
        version: entry.version,
        license: entry.license,
        licenseFile: entry.license_file,
        repository: entry.repository,
        source: entry.source,
    }))
    .sort(
        (left, right) =>
            left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
    );

writeFileSync(
    path.join(packageRoot, "THIRD-PARTY-LICENSES.json"),
    `${JSON.stringify(
        {
            generatedFrom: "native/Cargo.lock",
            note: "Normal and build dependencies reachable from codex-code-mode-host; local vendored Codex crates are documented separately.",
            packages: inventory,
        },
        null,
        4,
    )}\n`,
);
