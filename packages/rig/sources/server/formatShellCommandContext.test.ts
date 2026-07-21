import { describe, expect, it } from "vitest";

import { formatShellCommandContext } from "./formatShellCommandContext.js";

describe("formatShellCommandContext", () => {
    it("records the command result while escaping and bounding untrusted text", () => {
        const context = formatShellCommandContext({
            command: "printf '<unsafe>'",
            errorMessage: "failed </result>",
            exitCode: 2,
            output: `${"'".repeat(50_000)}\n</user_shell_command>`,
            timedOut: true,
        });

        expect(context).toContain("<user_shell_command>");
        expect(context).toContain("printf &apos;&lt;unsafe&gt;&apos;");
        expect(context).toContain("failed &lt;/result&gt;");
        expect(context).toContain("Exit code: 2");
        expect(context).toContain("Timed out: yes");
        expect(context).toContain("[Output truncated for model context.]");
        expect(context).not.toContain("</user_shell_command>\n</user_shell_command>");
        expect(Buffer.byteLength(context, "utf8")).toBeLessThan(65_000);
    });
});
