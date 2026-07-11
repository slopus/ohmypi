import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { shouldElevateToolInAutoMode } from "./shouldElevateToolInAutoMode.js";

describe("shouldElevateToolInAutoMode", () => {
    it("elevates only explicit shell requests and out-of-workspace paths", async () => {
        const root = await mkdtemp(join(tmpdir(), "rig-auto-elevation-"));
        try {
            const cwd = join(root, "workspace");
            await mkdir(cwd);
            await expect(
                shouldElevateToolInAutoMode("exec_command", { cmd: "pnpm test" }, cwd),
            ).resolves.toBe(false);
            await expect(
                shouldElevateToolInAutoMode(
                    "exec_command",
                    { cmd: "pnpm install", sandbox_permissions: "require_escalated" },
                    cwd,
                ),
            ).resolves.toBe(true);
            await expect(
                shouldElevateToolInAutoMode(
                    "Bash",
                    { command: "pnpm install", dangerouslyDisableSandbox: true },
                    cwd,
                ),
            ).resolves.toBe(true);
            await expect(
                shouldElevateToolInAutoMode("Write", { file_path: join(cwd, "inside.ts") }, cwd),
            ).resolves.toBe(false);
            await expect(
                shouldElevateToolInAutoMode("Write", { file_path: join(root, "outside.ts") }, cwd),
            ).resolves.toBe(true);
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });
});
