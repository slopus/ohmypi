export interface ClaudeSdkCaptureTarget {
    model: string;
    stem: string;
}

export interface ClaudeSdkRequestPayload {
    model?: string;
    system?: unknown;
    tools?: readonly Record<string, unknown>[];
    [key: string]: unknown;
}

export interface ClaudeSdkGolden {
    formatVersion: 1;
    source: {
        capture: "Claude Agent SDK through a blocking HTTP MITM proxy";
        claudeCodeVersion: string;
        commit: string;
        modelOption: string;
        platform: string;
        sdkPackage: "@anthropic-ai/claude-agent-sdk";
        sdkVersion: string;
    };
    system: unknown;
    tools: readonly Record<string, unknown>[];
    wireModel: string;
}
