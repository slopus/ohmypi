import { assertReleaseTagMatchesPackageVersion } from "./release/assertReleaseTagMatchesPackageVersion.js";
import { readPackageManifest } from "./release/readPackageManifest.js";

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag === undefined || releaseTag.length === 0) {
    throw new Error("RELEASE_TAG must contain the tag that triggered the release.");
}

const manifest = readPackageManifest();
assertReleaseTagMatchesPackageVersion(releaseTag, manifest);
console.log(`${releaseTag} matches ${manifest.name}@${manifest.version}.`);
