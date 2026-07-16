import { describe, expect, it } from "vitest";

import { createSandboxedCommand } from "./createSandboxedCommand.js";

describe("createSandboxedCommand", () => {
    it("passes the sandbox launcher and user command as direct process arguments", async () => {
        const userCommand = `node -e "console.log('quoted & safe')"`;

        const result = await createSandboxedCommand({
            command: userCommand,
            cwd: process.cwd(),
            mode: "read_only",
        });

        expect(result).toMatchObject({
            args: [
                expect.stringMatching(/cli\.js$/u),
                "--settings",
                expect.stringMatching(/\.json$/u),
                "-c",
                userCommand,
            ],
            command: process.execPath,
        });
    });
});
