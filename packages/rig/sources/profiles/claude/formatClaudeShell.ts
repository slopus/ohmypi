export function formatClaudeShell(shell: string | undefined, platform: NodeJS.Platform): string {
    const resolved = shell ?? "unknown";
    const name = resolved.includes("zsh") ? "zsh" : resolved.includes("bash") ? "bash" : resolved;
    return platform === "win32"
        ? `${name} (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes in paths)`
        : name;
}
