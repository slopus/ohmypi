import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { isPathInsideWorkspace } from "../agent/context/isPathInsideWorkspace.js";

const INTERNAL_TOOLS = new Set([
    "Agent",
    "AskUserQuestion",
    "SendMessage",
    "TaskCreate",
    "TaskGet",
    "TaskList",
    "TaskOutput",
    "TaskStop",
    "TaskUpdate",
    "TodoWrite",
    "followup_task",
    "interrupt_agent",
    "list_agents",
    "request_user_input",
    "spawn_agent",
    "update_plan",
    "wait_agent",
]);

const PATH_TOOLS = new Set([
    "Edit",
    "Glob",
    "Grep",
    "Read",
    "Write",
    "edit",
    "find",
    "grep",
    "ls",
    "read",
    "view_image",
    "write",
]);

const SHELL_TOOLS = new Set(["Bash", "bash", "exec_command"]);

export async function shouldReviewToolInAutoMode(
    toolName: string,
    args: unknown,
    cwd: string,
): Promise<boolean> {
    if (INTERNAL_TOOLS.has(toolName)) return false;
    if (SHELL_TOOLS.has(toolName)) return true;
    if (toolName === "write_stdin") {
        const chars = readString(args, "chars");
        return chars !== undefined && chars.length > 0;
    }
    if (toolName === "apply_patch") {
        return patchTouchesOutsideWorkspace(args, cwd);
    }
    if (PATH_TOOLS.has(toolName)) {
        const path = readString(args, "file_path") ?? readString(args, "path");
        return (
            path !== undefined && !(await isPathInsideWorkspace(cwd, resolveToolPath(path, cwd)))
        );
    }
    return true;
}

async function patchTouchesOutsideWorkspace(args: unknown, cwd: string): Promise<boolean> {
    const workdir = readString(args, "workdir") ?? cwd;
    const resolvedWorkdir = resolveToolPath(workdir, cwd);
    if (!(await isPathInsideWorkspace(cwd, resolvedWorkdir))) return true;
    const patch = readString(args, "patch");
    if (patch === undefined) return true;
    const filePattern = /^\*\*\* (?:Add File|Delete File|Update File|Move to): (.+)$/gmu;
    const checks = await Promise.all(
        [...patch.matchAll(filePattern)].map((match) => {
            const path = match[1];
            return path === undefined
                ? Promise.resolve(false)
                : isPathInsideWorkspace(cwd, resolveToolPath(path, resolvedWorkdir));
        }),
    );
    return checks.some((inside) => !inside);
}

function resolveToolPath(path: string, cwd: string): string {
    if (path === "~") return homedir();
    if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
    return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

function readString(value: unknown, key: string): string | undefined {
    if (value === null || typeof value !== "object") return undefined;
    const field = (value as Record<string, unknown>)[key];
    return typeof field === "string" ? field : undefined;
}
