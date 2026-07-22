import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function initializeCaptureGitRepository(cwd: string): Promise<void> {
    await execFileAsync("git", ["init", "--quiet", "--initial-branch", "main"], { cwd });
    await execFileAsync("git", ["config", "user.name", "Rig Claude Capture"], { cwd });
    await execFileAsync("git", ["config", "user.email", "capture@rig.invalid"], { cwd });
    await execFileAsync("git", ["commit", "--quiet", "--allow-empty", "-m", "Initial capture"], {
        cwd,
    });
}
