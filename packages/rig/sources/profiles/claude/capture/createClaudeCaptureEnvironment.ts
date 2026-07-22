export function createClaudeCaptureEnvironment(options: {
    captureHome: string;
    claudeConfigDirectory: string;
    proxyUrl: string;
    shell?: string;
}): NodeJS.ProcessEnv {
    const environment = Object.fromEntries(
        [
            "ComSpec",
            "LANG",
            "LC_ALL",
            "PATH",
            "PATHEXT",
            "SHELL",
            "SystemRoot",
            "TEMP",
            "TMP",
            "TMPDIR",
        ]
            .map((name) => [name, process.env[name]])
            .filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    return {
        ...environment,
        ANTHROPIC_API_KEY: "rig-profile-capture-placeholder",
        ANTHROPIC_BASE_URL: "http://api.anthropic.test",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        CLAUDE_CODE_ENABLE_TELEMETRY: "0",
        CLAUDE_CODE_OVERRIDE_DATE: "2000-01-01",
        CLAUDE_CONFIG_DIR: options.claudeConfigDirectory,
        DISABLE_ERROR_REPORTING: "1",
        DISABLE_TELEMETRY: "1",
        HOME: options.captureHome,
        HTTP_PROXY: options.proxyUrl,
        HTTPS_PROXY: options.proxyUrl,
        NODE_USE_ENV_PROXY: "1",
        NO_PROXY: "",
        ...(options.shell === undefined ? {} : { SHELL: options.shell }),
        TZ: "UTC",
        http_proxy: options.proxyUrl,
        https_proxy: options.proxyUrl,
        no_proxy: "",
    };
}
