import { describe, expect, it } from "vitest";

import { summarizeEscalatedShellAction } from "./summarizeEscalatedShellAction.js";

describe("summarizeEscalatedShellAction", () => {
    it("discloses the complete command and unrestricted boundary", () => {
        const command = `printf start\n${"x".repeat(140)}\nprintf VISIBLE_COMMAND_SUFFIX`;

        expect(
            summarizeEscalatedShellAction({
                command,
                cwd: "/home/rig",
                shell: "/bin/sh",
            }),
        ).toBe(
            `running "printf start\\n${"x".repeat(140)}\\nprintf VISIBLE_COMMAND_SUFFIX". Working directory: "/home/rig". Shell: "/bin/sh". Access: unrestricted filesystem and network access`,
        );
    });

    it("names the effective directory and default shell", () => {
        const action = summarizeEscalatedShellAction({
            command: "printf safe",
            cwd: "/workspace/project",
        });

        expect(action).toContain('Working directory: "/workspace/project"');
        expect(action).toContain('Shell: "the default shell"');
        expect(action).toContain("Access: unrestricted filesystem and network access");
    });
});
