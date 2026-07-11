export function createCodeReviewPrompt(command: string): string | undefined {
    const match = /^\/review(?:\s+([\s\S]*))?$/u.exec(command.trim());
    if (match === null) return undefined;

    const focus = match[1]?.trim() ?? "";
    return `Review the current workspace changes and identify actionable issues.

Inspect the repository state and the complete relevant diff, including staged, unstaged, and untracked changes. Read surrounding code when needed to verify whether a potential issue is real. Do not modify files or implement fixes.

Lead with findings ordered by severity. For each finding, explain the concrete impact and cite the relevant file and line. Prioritize correctness, regressions, security, data loss, broken user flows, and missing tests that leave changed behavior unverified. Keep summaries brief and secondary. If you find no issues, say so clearly and mention any remaining test or verification gaps.${focus.length === 0 ? "" : `\n\nThe user asked you to focus especially on: ${focus}`}`;
}
