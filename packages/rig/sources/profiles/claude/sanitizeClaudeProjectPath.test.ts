import { describe, expect, it } from "vitest";

import { sanitizeClaudeProjectPath } from "./sanitizeClaudeProjectPath.js";

describe("sanitizeClaudeProjectPath", () => {
    it("replaces non-alphanumeric path characters with hyphens", () => {
        expect(sanitizeClaudeProjectPath("/Users/example/repo.one")).toBe(
            "-Users-example-repo-one",
        );
    });

    it("matches Claude Code's bounded Node.js path key", () => {
        const path = `/workspace/${"nested/".repeat(40)}repository`;
        const sanitized = sanitizeClaudeProjectPath(path);

        expect(sanitized).toHaveLength(207);
        expect(sanitized).toBe(`${path.replaceAll(/[^a-zA-Z0-9]/gu, "-").slice(0, 200)}-agqhjh`);
    });
});
