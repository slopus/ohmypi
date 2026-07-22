import { describe, expect, test } from "vitest";

import { createCodeModeHostCommand } from "./createCodeModeHostCommand.js";

const binaryPath = "/opt/rig/codex-code-mode-host";

describe("createCodeModeHostCommand", () => {
    test("uses a restrictive macOS Seatbelt profile by default", () => {
        const command = createCodeModeHostCommand({
            binaryPath,
            env: {},
            platform: "darwin",
            resolveSandboxExecutable: () => "/usr/bin/sandbox-exec",
            sandbox: "auto",
        });

        expect(command.command).toBe("/usr/bin/sandbox-exec");
        expect(command.args.at(-1)).toBe(binaryPath);
        expect(command.args[0]).toBe("-p");
        expect(command.args[1]).toContain("(deny network-inbound)");
        expect(command.args[1]).toContain("(deny network-outbound)");
        expect(command.args[1]).toContain(`(literal ${JSON.stringify(binaryPath)})`);
        expect(command.args[1]).not.toContain("/Users");
        expect(command.cwd).toBe("/");
    });

    test("uses Bubblewrap with an isolated network and minimal mounts on Linux", () => {
        const command = createCodeModeHostCommand({
            binaryPath,
            env: {},
            platform: "linux",
            resolveSandboxExecutable: () => "/usr/bin/bwrap",
            sandbox: "auto",
            systemPathExists: () => true,
        });

        expect(command.command).toBe("/usr/bin/bwrap");
        expect(command.args).toContain("--unshare-net");
        expect(command.args).toContain("--die-with-parent");
        expect(command.args).toContain("--new-session");
        expect(command.args).toContain("--tmpfs");
        expect(command.args).toContain("/tmp");
        expect(
            command.args.some(
                (argument, index) =>
                    argument === "--ro-bind" &&
                    command.args[index + 1] === "/" &&
                    command.args[index + 2] === "/",
            ),
        ).toBe(false);
        expect(command.args.slice(-2)).toEqual(["--", "/rig-codemode-codex-host"]);
        expect(command.cwd).toBe("/");
    });

    test("falls back to the direct process when auto sandboxing is unavailable", () => {
        expect(
            createCodeModeHostCommand({
                binaryPath,
                env: {},
                platform: "linux",
                resolveSandboxExecutable: () => undefined,
                sandbox: "auto",
            }),
        ).toEqual({ args: [], command: binaryPath });
    });

    test("fails closed when required sandboxing is unavailable", () => {
        expect(() =>
            createCodeModeHostCommand({
                binaryPath,
                env: {},
                platform: "win32",
                resolveSandboxExecutable: () => undefined,
                sandbox: "required",
            }),
        ).toThrow("required");
    });

    test("supports explicitly disabling the process sandbox", () => {
        expect(
            createCodeModeHostCommand({
                binaryPath,
                env: {},
                platform: "darwin",
                resolveSandboxExecutable: () => "/usr/bin/sandbox-exec",
                sandbox: "disabled",
            }),
        ).toEqual({ args: [], command: binaryPath });
    });
});
