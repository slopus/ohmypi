import { afterEach, describe, expect, it, vi } from "vitest";

import { createClaudeCaptureEnvironment } from "./createClaudeCaptureEnvironment.js";

describe("createClaudeCaptureEnvironment", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("removes inherited Claude credentials and alternate routing", () => {
        for (const name of [
            "ANTHROPIC_AUTH_TOKEN",
            "CLAUDE_CODE_OAUTH_TOKEN",
            "CLAUDE_CODE_USE_ANTHROPIC_AWS",
            "CLAUDE_CODE_USE_BEDROCK",
            "CLAUDE_CODE_USE_FOUNDRY",
            "CLAUDE_CODE_USE_GATEWAY",
            "CLAUDE_CODE_USE_MANTLE",
            "CLAUDE_CODE_USE_VERTEX",
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
            "CLAUDE_CODE_REMOTE",
            "CLAUDE_CODE_SIMPLE",
            "USER_TYPE",
        ]) {
            vi.stubEnv(name, "inherited");
        }

        const environment = createClaudeCaptureEnvironment({
            captureHome: "/capture/home",
            claudeConfigDirectory: "/capture/config",
            proxyUrl: "http://127.0.0.1:1234",
        });

        expect(environment).toMatchObject({
            ANTHROPIC_API_KEY: "rig-profile-capture-placeholder",
            ANTHROPIC_BASE_URL: "http://api.anthropic.test",
            CLAUDE_CONFIG_DIR: "/capture/config",
            HOME: "/capture/home",
            HTTPS_PROXY: "http://127.0.0.1:1234",
        });
        for (const name of [
            "ANTHROPIC_AUTH_TOKEN",
            "CLAUDE_CODE_OAUTH_TOKEN",
            "CLAUDE_CODE_USE_ANTHROPIC_AWS",
            "CLAUDE_CODE_USE_BEDROCK",
            "CLAUDE_CODE_USE_FOUNDRY",
            "CLAUDE_CODE_USE_GATEWAY",
            "CLAUDE_CODE_USE_MANTLE",
            "CLAUDE_CODE_USE_VERTEX",
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
            "CLAUDE_CODE_REMOTE",
            "CLAUDE_CODE_SIMPLE",
            "USER_TYPE",
        ]) {
            expect(environment).not.toHaveProperty(name);
        }
    });
});
