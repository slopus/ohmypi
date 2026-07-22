import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

import { initializeCaptureGitRepository } from "./initializeCaptureGitRepository.js";

const execFileAsync = promisify(execFile);

export async function createCaptureGitWorktree(
    repositoryRoot: string,
    worktreePath: string,
): Promise<void> {
    await mkdir(repositoryRoot, { recursive: true });
    await initializeCaptureGitRepository(repositoryRoot);
    await execFileAsync(
        "git",
        ["worktree", "add", "--quiet", "-b", "capture-worktree", worktreePath],
        { cwd: repositoryRoot },
    );
}
