import { homedir } from "node:os";
import { join } from "node:path";

import type { ProfilePromptContext } from "../impl/types.js";
import { formatClaudeShell } from "./formatClaudeShell.js";
import { sanitizeClaudeProjectPath } from "./sanitizeClaudeProjectPath.js";

const replacements = {
    claudeConfigDirectory: "$CLAUDE_CONFIG_DIR",
    cwd: "$CLAUDE_RUNTIME_CWD",
    gitRepository: "$CLAUDE_RUNTIME_IS_GIT_REPOSITORY",
    gitStatus: "$CLAUDE_RUNTIME_GIT_STATUS",
    osVersion: "$CLAUDE_RUNTIME_OS_VERSION",
    platform: "$CLAUDE_RUNTIME_PLATFORM",
    projectSlug: "$CLAUDE_RUNTIME_PROJECT_SLUG",
    shell: "$CLAUDE_RUNTIME_SHELL",
} as const;

export const CLAUDE_DYNAMIC_PROMPT_TOKENS = Object.values(replacements);
const requiredDynamicPromptTokens = [
    replacements.cwd,
    replacements.gitRepository,
    replacements.gitStatus,
    replacements.osVersion,
    replacements.platform,
    replacements.shell,
] as const;

const dynamicPromptTokenPattern = new RegExp(
    CLAUDE_DYNAMIC_PROMPT_TOKENS.map((token) => token.replace("$", "\\$")).join("|"),
    "gu",
);

export function renderClaudeSystemPrompt(template: string, context: ProfilePromptContext): string {
    const cwd = context.cwd;
    const platform = context.platform;
    const osVersion = context.osVersion;
    if (cwd === undefined || platform === undefined || osVersion === undefined) {
        throw new Error("Claude prompt rendering requires cwd, platform, and OS version.");
    }

    const projectPath = context.projectRoot ?? cwd;
    const projectSlug = sanitizeClaudeProjectPath(projectPath);
    const configDirectory =
        context.claudeConfigDirectory ?? join(context.home ?? homedir(), ".claude");
    const shell = formatClaudeShell(context.shell, platform);
    const values: Readonly<Record<(typeof replacements)[keyof typeof replacements], string>> = {
        [replacements.claudeConfigDirectory]: configDirectory,
        [replacements.cwd]: cwd,
        [replacements.gitRepository]: String(context.isGitRepository ?? false),
        [replacements.gitStatus]: context.claudeGitStatus ?? "",
        [replacements.osVersion]: osVersion,
        [replacements.platform]: platform,
        [replacements.projectSlug]: projectSlug,
        [replacements.shell]: shell,
    };

    for (const token of requiredDynamicPromptTokens) {
        if (!template.includes(token)) {
            throw new Error(`Claude prompt template does not contain '${token}'.`);
        }
    }
    return template.replace(
        dynamicPromptTokenPattern,
        (token) => values[token as keyof typeof values],
    );
}
