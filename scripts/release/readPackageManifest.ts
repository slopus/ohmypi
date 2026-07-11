import { readFileSync } from "node:fs";

import type { PackageManifest } from "./PackageManifest.js";

export function readPackageManifest(): PackageManifest {
    return JSON.parse(
        readFileSync(new URL("../../packages/rig/package.json", import.meta.url), "utf8"),
    ) as PackageManifest;
}
