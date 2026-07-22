import { describe, expect, it } from "vitest";

import { renderClaudeSystemPrompt } from "./renderClaudeSystemPrompt.js";

describe("renderClaudeSystemPrompt", () => {
    it("renders every captured dynamic value from the active session", () => {
        const template = [
            "$CLAUDE_CONFIG_DIR/projects/$CLAUDE_RUNTIME_PROJECT_SLUG/memory/",
            "Primary working directory: $CLAUDE_RUNTIME_CWD",
            "Is a git repository: $CLAUDE_RUNTIME_IS_GIT_REPOSITORY",
            "Platform: $CLAUDE_RUNTIME_PLATFORM",
            "Shell: $CLAUDE_RUNTIME_SHELL",
            "OS Version: $CLAUDE_RUNTIME_OS_VERSION$CLAUDE_RUNTIME_GIT_STATUS",
        ].join("\n");

        expect(
            renderClaudeSystemPrompt(template, {
                claudeConfigDirectory: "/configs/claude",
                cwd: "/workspace/repo/packages/rig",
                home: "/home/test",
                isGitRepository: true,
                modelId: "anthropic/claude-sonnet-5",
                osVersion: "Linux 6.8.0",
                platform: "linux",
                projectRoot: "/workspace/repo",
                providerId: "claude-work",
                shell: "/usr/bin/bash",
            }),
        ).toBe(
            [
                "/configs/claude/projects/-workspace-repo/memory/",
                "Primary working directory: /workspace/repo/packages/rig",
                "Is a git repository: true",
                "Platform: linux",
                "Shell: bash",
                "OS Version: Linux 6.8.0",
            ].join("\n"),
        );
    });

    it("reproduces Claude Code's Windows shell guidance", () => {
        const template = [
            "$CLAUDE_CONFIG_DIR",
            "$CLAUDE_RUNTIME_PROJECT_SLUG",
            "$CLAUDE_RUNTIME_CWD",
            "$CLAUDE_RUNTIME_IS_GIT_REPOSITORY",
            "$CLAUDE_RUNTIME_PLATFORM",
            "$CLAUDE_RUNTIME_SHELL",
            "$CLAUDE_RUNTIME_OS_VERSION",
            "$CLAUDE_RUNTIME_GIT_STATUS",
        ].join("\n");
        expect(
            renderClaudeSystemPrompt(template, {
                cwd: "C:\\repo",
                home: "C:\\Users\\test",
                modelId: "anthropic/claude-sonnet-5",
                osVersion: "Windows 11 Pro 10.0.26100",
                platform: "win32",
                providerId: "claude",
                shell: "C:\\Program Files\\Git\\bin\\bash.exe",
            }),
        ).toContain(
            "bash (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes in paths)",
        );
    });

    it("does not treat token-shaped runtime values as template tokens", () => {
        const template = [
            "$CLAUDE_CONFIG_DIR",
            "$CLAUDE_RUNTIME_PROJECT_SLUG",
            "$CLAUDE_RUNTIME_CWD",
            "$CLAUDE_RUNTIME_IS_GIT_REPOSITORY",
            "$CLAUDE_RUNTIME_PLATFORM",
            "$CLAUDE_RUNTIME_SHELL",
            "$CLAUDE_RUNTIME_OS_VERSION",
            "$CLAUDE_RUNTIME_GIT_STATUS",
        ].join("\n");
        const cwd = "/workspace/$CLAUDE_RUNTIME_SHELL/repository";

        expect(
            renderClaudeSystemPrompt(template, {
                cwd,
                modelId: "anthropic/claude-sonnet-5",
                osVersion: "Linux 6.8.0",
                platform: "linux",
                providerId: "claude",
                shell: "/bin/zsh",
            }),
        ).toContain(cwd);
    });
});
