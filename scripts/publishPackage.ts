import { fileURLToPath } from "node:url";

import { isAlreadyPublishedError } from "./release/isAlreadyPublishedError.js";
import { readPackageManifest } from "./release/readPackageManifest.js";
import { runCommand } from "./release/runCommand.js";

const PACKAGE_DIRECTORY = fileURLToPath(new URL("../packages/rig/", import.meta.url));
const manifest = readPackageManifest();

console.log(`Publishing ${manifest.name}@${manifest.version}...`);
const publishResult = runCommand("pnpm", ["publish", "--access", "public", "--no-git-checks"], {
    allowFailure: true,
    captureOutput: true,
    cwd: PACKAGE_DIRECTORY,
});

if (publishResult.stdout.length > 0) {
    console.log(publishResult.stdout);
}

if (publishResult.status === 0) {
    if (publishResult.stderr.length > 0) {
        console.error(publishResult.stderr);
    }
    console.log(`Published ${manifest.name}@${manifest.version} successfully.`);
} else if (isAlreadyPublishedError(publishResult.stderr)) {
    console.log(`${manifest.name}@${manifest.version} is already published.`);
} else {
    if (publishResult.stderr.length > 0) {
        console.error(publishResult.stderr);
    }
    throw new Error(`Publishing ${manifest.name}@${manifest.version} failed.`);
}
