import { readPackageManifest } from "./release/readPackageManifest.js";
import { runCommand } from "./release/runCommand.js";

const VERSION_BUMPS = new Set([
    "major",
    "minor",
    "patch",
    "premajor",
    "preminor",
    "prepatch",
    "prerelease",
]);
const SEMANTIC_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const USAGE = `Usage: pnpm release <version>

Examples:
  pnpm release 0.1.0
  pnpm release patch
  pnpm release minor`;

async function release(): Promise<void> {
    const releaseInput = process.argv[2];
    if (releaseInput === "--help" || releaseInput === "-h") {
        console.log(USAGE);
        return;
    }
    if (
        releaseInput === undefined ||
        process.argv.length !== 3 ||
        (!VERSION_BUMPS.has(releaseInput) && !SEMANTIC_VERSION.test(releaseInput))
    ) {
        throw new Error(USAGE);
    }

    const branch = runCommand("git", ["branch", "--show-current"], {
        captureOutput: true,
    }).stdout;
    if (branch !== "main") {
        throw new Error(
            `Releases must run from the main branch. The current branch is ${branch || "detached"}.`,
        );
    }

    const worktreeStatus = runCommand("git", ["status", "--porcelain"], {
        captureOutput: true,
    }).stdout;
    if (worktreeStatus.length > 0) {
        throw new Error("The working tree must be clean before creating a release.");
    }

    const initialManifest = readPackageManifest();
    const tagsAtHead = runCommand("git", ["tag", "--points-at", "HEAD"], {
        captureOutput: true,
    }).stdout.split("\n");
    const retryingRelease =
        releaseInput === initialManifest.version &&
        tagsAtHead.includes(`v${initialManifest.version}`);
    if (releaseInput === initialManifest.version && !retryingRelease) {
        throw new Error(
            `${initialManifest.name} is already version ${initialManifest.version}. Choose a newer version or a version bump.`,
        );
    }

    console.log("Checking the latest main branch...");
    runCommand("git", ["fetch", "origin", "main"]);
    const head = runCommand("git", ["rev-parse", "HEAD"], { captureOutput: true }).stdout;
    const originMain = runCommand("git", ["rev-parse", "origin/main"], {
        captureOutput: true,
    }).stdout;
    if (head !== originMain) {
        const originIsAncestor =
            runCommand("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {
                allowFailure: true,
                captureOutput: true,
            }).status === 0;
        const commitsAhead = Number(
            runCommand("git", ["rev-list", "--count", "origin/main..HEAD"], {
                captureOutput: true,
            }).stdout,
        );
        if (!retryingRelease || !originIsAncestor || commitsAhead !== 1) {
            throw new Error(
                "Local main must match origin/main. Update the branch before creating a release.",
            );
        }
        console.log(`Resuming the local v${initialManifest.version} release commit.`);
    }

    console.log("Checking npm authentication...");
    runCommand("pnpm", ["whoami"]);

    console.log("Validating the release...");
    runCommand("pnpm", ["run", "check"]);
    runCommand("pnpm", ["test"]);
    runCommand("pnpm", ["run", "build"]);

    if (!retryingRelease) {
        console.log(`Creating the ${releaseInput} release commit and tag...`);
        runCommand("pnpm", ["version", releaseInput, "--message", "Release v%s"]);
    }

    const releaseManifest = readPackageManifest();
    console.log(`Previewing ${releaseManifest.name}@${releaseManifest.version}...`);
    runCommand("pnpm", ["publish", "--access", "public", "--dry-run", "--no-git-checks"]);

    console.log("Pushing the release commit and tag...");
    runCommand("git", ["push", "origin", "main", "--follow-tags"]);

    const publishedVersion = runCommand(
        "pnpm",
        ["view", `${releaseManifest.name}@${releaseManifest.version}`, "version", "--json"],
        { allowFailure: true, captureOutput: true },
    );
    if (publishedVersion.status === 0) {
        console.log(`${releaseManifest.name}@${releaseManifest.version} is already published.`);
        return;
    }

    console.log(`Publishing ${releaseManifest.name}@${releaseManifest.version}...`);
    runCommand("pnpm", ["publish", "--access", "public"]);

    const verifiedVersion = runCommand(
        "pnpm",
        ["view", `${releaseManifest.name}@${releaseManifest.version}`, "version", "--json"],
        { captureOutput: true },
    ).stdout;
    if (JSON.parse(verifiedVersion) !== releaseManifest.version) {
        throw new Error(`The npm registry did not return version ${releaseManifest.version}.`);
    }

    console.log(`Published ${releaseManifest.name}@${releaseManifest.version} successfully.`);
}

try {
    await release();
} catch (error) {
    console.error(error instanceof Error ? error.message : "The release failed unexpectedly.");
    process.exitCode = 1;
}
