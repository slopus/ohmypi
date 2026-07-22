import type { BashContext } from "../../agent/context/BashContext.js";

// Claude Code does not bound these subprocesses; Rig keeps optional prompt enrichment
// off the critical path with tighter time and output limits.
const commandOptions = {
    maxOutputBytes: 10_000,
    timeoutMs: 2_000,
} as const;

export async function createClaudeGitStatus(
    bash: BashContext,
    cwd: string,
): Promise<string | undefined> {
    try {
        const [branch, originHead, originMain, originMaster, status, log, userName] =
            await Promise.all([
                bash.run({ ...commandOptions, command: "git branch --show-current", cwd }),
                bash.run({
                    ...commandOptions,
                    command: "git symbolic-ref --quiet --short refs/remotes/origin/HEAD",
                    cwd,
                }),
                bash.run({
                    ...commandOptions,
                    command: "git show-ref --verify --quiet refs/remotes/origin/main",
                    cwd,
                }),
                bash.run({
                    ...commandOptions,
                    command: "git show-ref --verify --quiet refs/remotes/origin/master",
                    cwd,
                }),
                bash.run({
                    ...commandOptions,
                    command: "git --no-optional-locks status --short",
                    cwd,
                }),
                bash.run({
                    ...commandOptions,
                    command: "git --no-optional-locks log --oneline -n 5",
                    cwd,
                }),
                bash.run({ ...commandOptions, command: "git config user.name", cwd }),
            ]);
        if (branch.exitCode !== 0 || branch.timedOut || status.timedOut || log.timedOut) {
            return undefined;
        }

        const branchName = branch.stdout.trim() || "HEAD";
        const remoteHead = originHead.stdout.trim();
        const mainBranch = remoteHead.startsWith("origin/")
            ? remoteHead.slice("origin/".length)
            : originMain.exitCode === 0
              ? "main"
              : originMaster.exitCode === 0
                ? "master"
                : "main";
        const rawStatus = status.exitCode === 0 ? status.stdout.trim() : "";
        const truncatedStatus =
            rawStatus.length > 2_000
                ? `${rawStatus.slice(0, 2_000)}\n... (truncated because it exceeds 2k characters. If you need more information, run "git status" using BashTool)`
                : rawStatus;
        const user = userName.exitCode === 0 ? userName.stdout.trim() : "";

        return [
            "\n\ngitStatus: This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.",
            `Current branch: ${branchName}`,
            `Main branch (you will usually use this for PRs): ${mainBranch}`,
            ...(user.length === 0 ? [] : [`Git user: ${user}`]),
            `Status:\n${truncatedStatus || "(clean)"}`,
            `Recent commits:\n${log.exitCode === 0 ? log.stdout.trim() : ""}`,
        ].join("\n\n");
    } catch {
        return undefined;
    }
}
