import { describe, expect, it } from "vitest";

import { renderExecCommand } from "./renderExecCommand.js";

describe("renderExecCommand", () => {
    it("wraps and highlights commands with Codex-style output trees", () => {
        const rendered = renderExecCommand(
            {
                command: "git show --stat HEAD; printf '%s\\n' $HOME/projects/rig",
                output: Array.from({ length: 14 }, (_, index) => `output ${index + 1}`).join("\n"),
                type: "exec_command",
            },
            {
                brand: "\x1b[38;5;202m",
                primary: "\x1b[39m",
                status: "\x1b[32m",
                verb: "Ran",
                width: 48,
            },
        );
        const plain = rendered.map((line) => stripAnsi(line).trimEnd());

        expect(rendered.join("\n")).toContain("\x1b[38;5;75mgit\x1b[39m");
        expect(rendered.join("\n")).toContain("\x1b[38;5;168m--stat\x1b[39m");
        expect(plain[0]).toContain("• Ran git show --stat HEAD; printf");
        expect(plain).toContain("  │ … +4 lines");
        expect(plain.at(-1)).toBe("  └ output 14");
    });
});

function stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/gu, "");
}
