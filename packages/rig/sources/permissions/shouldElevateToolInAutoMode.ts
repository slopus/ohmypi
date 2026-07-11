import { shouldReviewToolInAutoMode } from "./shouldReviewToolInAutoMode.js";

const PATH_TOOLS = new Set([
    "Edit",
    "Glob",
    "Grep",
    "Read",
    "Write",
    "apply_patch",
    "edit",
    "find",
    "grep",
    "ls",
    "read",
    "view_image",
    "write",
]);

export async function shouldElevateToolInAutoMode(
    toolName: string,
    args: unknown,
    cwd: string,
): Promise<boolean> {
    if (toolName === "exec_command") {
        return readString(args, "sandbox_permissions") === "require_escalated";
    }
    if (toolName === "Bash") {
        return readBoolean(args, "dangerouslyDisableSandbox") === true;
    }
    return PATH_TOOLS.has(toolName) && shouldReviewToolInAutoMode(toolName, args, cwd);
}

function readBoolean(value: unknown, key: string): boolean | undefined {
    if (value === null || typeof value !== "object") return undefined;
    const field = (value as Record<string, unknown>)[key];
    return typeof field === "boolean" ? field : undefined;
}

function readString(value: unknown, key: string): string | undefined {
    if (value === null || typeof value !== "object") return undefined;
    const field = (value as Record<string, unknown>)[key];
    return typeof field === "string" ? field : undefined;
}
