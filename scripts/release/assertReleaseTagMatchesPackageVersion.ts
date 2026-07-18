import type { PackageManifest } from "./PackageManifest.js";

export function assertReleaseTagMatchesPackageVersion(
    releaseTag: string,
    manifest: PackageManifest,
): void {
    const expectedTag = `v${manifest.version}`;
    if (releaseTag !== expectedTag) {
        throw new Error(
            `Release tag ${releaseTag} does not match ${manifest.name} version ${manifest.version}. Expected ${expectedTag}.`,
        );
    }
}
