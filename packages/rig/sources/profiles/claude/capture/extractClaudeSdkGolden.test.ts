import { describe, expect, it } from "vitest";

import { extractClaudeSdkGolden } from "./extractClaudeSdkGolden.js";

describe("extractClaudeSdkGolden", () => {
    it("preserves every system block and tool in emitted order", () => {
        expect(
            extractClaudeSdkGolden({
                captureCwd: "/tmp/capture-123",
                captureHome: "/tmp/home-123",
                captureIsGitRepository: false,
                captureOsVersion: "Darwin 25.2.0",
                capturePlatform: "darwin",
                captureProjectPath: "/tmp/capture-123",
                captureShell: "/bin/zsh",
                claudeCodeVersion: "2.1.201",
                claudeConfigDirectory: "/tmp/config-123",
                commit: "source-commit",
                modelOption: "sonnet",
                payload: {
                    model: "claude-sonnet-5",
                    system: [
                        { type: "text", text: "Static prompt" },
                        { type: "text", text: "cwd: /tmp/capture-123" },
                    ],
                    tools: [
                        { name: "Write", input_schema: { type: "object" } },
                        { name: "Bash", input_schema: { type: "object" } },
                    ],
                },
                sdkVersion: "0.3.201",
                platform: "darwin-arm64",
            }),
        ).toMatchObject({
            source: {
                capture: "Claude Agent SDK through a blocking HTTP MITM proxy",
                claudeCodeVersion: "2.1.201",
                modelOption: "sonnet",
                sdkVersion: "0.3.201",
            },
            system: [
                { type: "text", text: "Static prompt" },
                {
                    type: "text",
                    text: "cwd: $CLAUDE_RUNTIME_CWD$CLAUDE_RUNTIME_GIT_STATUS",
                },
            ],
            tools: [{ name: "Write" }, { name: "Bash" }],
            wireModel: "claude-sonnet-5",
        });
    });

    it("fails when the proxy did not capture the profile-bearing request", () => {
        expect(() =>
            extractClaudeSdkGolden({
                captureCwd: "/tmp/capture",
                captureHome: "/tmp/home",
                captureIsGitRepository: false,
                captureOsVersion: "Darwin 25.2.0",
                capturePlatform: "darwin",
                captureProjectPath: "/tmp/capture",
                captureShell: "/bin/zsh",
                claudeCodeVersion: "2.1.201",
                claudeConfigDirectory: "/tmp/config",
                commit: "source-commit",
                modelOption: "sonnet",
                payload: { model: "claude-sonnet-5" },
                sdkVersion: "0.3.201",
                platform: "darwin-arm64",
            }),
        ).toThrow("did not contain a system prompt");
    });

    it("fails when a new home-directory dynamic value has no runtime renderer", () => {
        expect(() =>
            extractClaudeSdkGolden({
                captureCwd: "/tmp/capture",
                captureHome: "/tmp/home",
                captureIsGitRepository: false,
                captureOsVersion: "Darwin 25.2.0",
                capturePlatform: "darwin",
                captureProjectPath: "/tmp/capture",
                captureShell: "/bin/zsh",
                claudeCodeVersion: "2.1.201",
                claudeConfigDirectory: "/tmp/config",
                commit: "source-commit",
                modelOption: "sonnet",
                payload: {
                    model: "claude-sonnet-5",
                    system: [{ type: "text", text: "Home: /tmp/home" }],
                    tools: [],
                },
                sdkVersion: "0.3.201",
                platform: "darwin-arm64",
            }),
        ).toThrow("home directory without a runtime renderer");
    });
});
