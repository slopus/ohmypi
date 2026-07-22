export const PLATFORM_TARGETS = {
    "darwin-arm64": {
        alias: "@slopus/rig-codemode-codex-darwin-arm64",
        arch: "arm64",
        os: "darwin",
        tag: "darwin-arm64",
        target: "aarch64-apple-darwin",
    },
    "darwin-x64": {
        alias: "@slopus/rig-codemode-codex-darwin-x64",
        arch: "x64",
        os: "darwin",
        tag: "darwin-x64",
        target: "x86_64-apple-darwin",
    },
    "linux-arm64": {
        alias: "@slopus/rig-codemode-codex-linux-arm64",
        arch: "arm64",
        os: "linux",
        tag: "linux-arm64",
        target: "aarch64-unknown-linux-musl",
    },
    "linux-x64": {
        alias: "@slopus/rig-codemode-codex-linux-x64",
        arch: "x64",
        os: "linux",
        tag: "linux-x64",
        target: "x86_64-unknown-linux-musl",
    },
    "win32-arm64": {
        alias: "@slopus/rig-codemode-codex-win32-arm64",
        arch: "arm64",
        os: "win32",
        tag: "win32-arm64",
        target: "aarch64-pc-windows-msvc",
    },
    "win32-x64": {
        alias: "@slopus/rig-codemode-codex-win32-x64",
        arch: "x64",
        os: "win32",
        tag: "win32-x64",
        target: "x86_64-pc-windows-msvc",
    },
} as const;

export type PlatformKey = keyof typeof PLATFORM_TARGETS;
