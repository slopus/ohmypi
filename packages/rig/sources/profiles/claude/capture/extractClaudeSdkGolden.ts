import type { ClaudeSdkGolden, ClaudeSdkRequestPayload } from "./types.js";
import { formatClaudeShell } from "../formatClaudeShell.js";
import { sanitizeClaudeProjectPath } from "../sanitizeClaudeProjectPath.js";
import { withClaudeGitStatusToken } from "./withClaudeGitStatusToken.js";

export function extractClaudeSdkGolden(options: {
    captureCwd: string;
    captureHome: string;
    captureIsGitRepository: boolean;
    captureOsVersion: string;
    capturePlatform: NodeJS.Platform;
    captureProjectPath: string;
    captureShell: string | undefined;
    claudeCodeVersion: string;
    claudeConfigDirectory: string;
    commit: string;
    modelOption: string;
    payload: ClaudeSdkRequestPayload;
    platform: string;
    sdkVersion: string;
}): ClaudeSdkGolden {
    if (typeof options.payload.model !== "string") {
        throw new Error("The intercepted Claude SDK request did not contain a model.");
    }
    if (options.payload.system === undefined) {
        throw new Error("The intercepted Claude SDK request did not contain a system prompt.");
    }
    if (!Array.isArray(options.payload.tools)) {
        throw new Error("The intercepted Claude SDK request did not contain tools.");
    }

    const captureProjectSlug = sanitizeClaudeProjectPath(options.captureProjectPath);
    const captureShell = formatClaudeShell(options.captureShell, options.capturePlatform);
    const normalize = (value: unknown): unknown => {
        if (typeof value === "string") {
            const normalized = value
                .replaceAll(captureProjectSlug, "$CLAUDE_RUNTIME_PROJECT_SLUG")
                .replaceAll(options.claudeConfigDirectory, "$CLAUDE_CONFIG_DIR")
                .replaceAll(options.captureCwd, "$CLAUDE_RUNTIME_CWD")
                .replaceAll(
                    `Is a git repository: ${options.captureIsGitRepository}`,
                    "Is a git repository: $CLAUDE_RUNTIME_IS_GIT_REPOSITORY",
                )
                .replaceAll(
                    `Platform: ${options.capturePlatform}`,
                    "Platform: $CLAUDE_RUNTIME_PLATFORM",
                )
                .replaceAll(`Shell: ${captureShell}`, "Shell: $CLAUDE_RUNTIME_SHELL")
                .replaceAll(
                    `OS Version: ${options.captureOsVersion}`,
                    "OS Version: $CLAUDE_RUNTIME_OS_VERSION",
                )
                .replace(/\n\ngitStatus:[\s\S]*$/u, "$CLAUDE_RUNTIME_GIT_STATUS");
            if (normalized.includes(options.captureHome)) {
                throw new Error(
                    "Claude SDK capture exposed the isolated home directory without a runtime renderer.",
                );
            }
            return normalized;
        }
        if (Array.isArray(value)) return value.map(normalize);
        if (value !== null && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, normalize(item)]),
            );
        }
        return value;
    };

    return {
        formatVersion: 1,
        source: {
            capture: "Claude Agent SDK through a blocking HTTP MITM proxy",
            claudeCodeVersion: options.claudeCodeVersion,
            commit: options.commit,
            modelOption: options.modelOption,
            platform: options.platform,
            sdkPackage: "@anthropic-ai/claude-agent-sdk",
            sdkVersion: options.sdkVersion,
        },
        system: withClaudeGitStatusToken(normalize(options.payload.system)),
        tools: options.payload.tools.map((tool) => normalize(tool) as Record<string, unknown>),
        wireModel: options.payload.model,
    };
}
