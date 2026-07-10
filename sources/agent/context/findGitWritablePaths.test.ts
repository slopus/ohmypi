import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findGitWritablePaths } from "./findGitWritablePaths.js";

const tempDirs: string[] = [];

describe("findGitWritablePaths", () => {
    afterEach(async () => {
        await Promise.all(
            tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true })),
        );
    });

    it("finds repository metadata from a nested working directory", async () => {
        const root = await makeTempDir();
        const repository = join(root, "repository");
        const nested = join(repository, "sources", "app");
        await mkdir(join(repository, ".git"), { recursive: true });
        await mkdir(nested, { recursive: true });

        await expect(findGitWritablePaths(nested)).resolves.toEqual([
            await realpath(join(repository, ".git")),
        ]);
    });

    it("includes linked-worktree and common Git metadata", async () => {
        const root = await makeTempDir();
        const commonDirectory = join(root, "repository", ".git");
        const gitDirectory = join(commonDirectory, "worktrees", "feature");
        const worktree = join(root, "feature");
        await mkdir(gitDirectory, { recursive: true });
        await mkdir(worktree, { recursive: true });
        await writeFile(join(gitDirectory, "commondir"), "../..");
        await writeFile(join(worktree, ".git"), `gitdir: ${gitDirectory}\n`);

        await expect(findGitWritablePaths(worktree)).resolves.toEqual([
            await realpath(gitDirectory),
            await realpath(commonDirectory),
        ]);
    });

    it("does not trust a workspace-controlled Git pointer to an arbitrary directory", async () => {
        const root = await makeTempDir();
        const worktree = join(root, "feature");
        const outside = join(root, "outside");
        await mkdir(worktree, { recursive: true });
        await mkdir(outside, { recursive: true });
        await writeFile(join(worktree, ".git"), `gitdir: ${outside}\n`);

        await expect(findGitWritablePaths(worktree)).resolves.toEqual([]);
    });
});

async function makeTempDir(): Promise<string> {
    const path = await mkdtemp(join(tmpdir(), "rig-git-paths-"));
    tempDirs.push(path);
    return path;
}
