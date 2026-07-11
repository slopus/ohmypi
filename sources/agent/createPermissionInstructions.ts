import type { PermissionMode } from "../permissions/index.js";

export function createPermissionInstructions(mode: PermissionMode): string {
    if (mode === "auto") {
        return "You are in Auto mode. Routine reads and workspace edits run automatically. Permission-sensitive actions are reviewed automatically; low-risk actions proceed, while potentially unsafe actions require one-time user approval. Shell commands remain workspace-sandboxed unless you explicitly request escalation with the tool's sandbox option. Request escalation only when the sandbox blocks necessary work, and give a clear reason. Do not work around a denied permission or retry the same action unchanged.";
    }
    if (mode === "read_only") {
        return "You are in Read only mode. You may inspect files and run non-mutating shell commands. File tools cannot make changes; shell commands may only write temporary files, and shell network access is blocked.";
    }
    if (mode === "workspace_write") {
        return "You are in Workspace write mode. You may modify files inside the working directory. Shell writes outside it and shell network access are blocked.";
    }
    return "You are in Full access mode. Filesystem, shell, and network access are unrestricted.";
}
