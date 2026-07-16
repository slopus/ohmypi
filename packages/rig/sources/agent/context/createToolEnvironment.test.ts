import { describe, expect, it } from "vitest";

import { createToolEnvironment } from "./createToolEnvironment.js";

describe("createToolEnvironment", () => {
    it("keeps developer toolchains while removing model-writable search paths", async () => {
        const environment = {
            HOME: "/home/user",
            PATH: "/workspace/node_modules/.bin:/home/user/.cargo/bin:/tmp/attacker:/nix/store/tool/bin:/home/user/.ssh/bin:relative/bin:/usr/bin",
            TMPDIR: "/tmp",
        };

        const restricted = await createToolEnvironment("workspace_write", environment, {
            cwd: "/workspace",
            homeDirectory: "/home/user",
            temporaryDirectory: "/tmp",
        });

        if (process.platform === "win32") {
            expect(restricted.PATH).toBe(environment.PATH);
        } else {
            const paths = restricted.PATH?.split(":") ?? [];
            expect(paths.some((path) => path.endsWith("/home/user/.cargo/bin"))).toBe(true);
            expect(paths).toContain("/nix/store/tool/bin");
            expect(paths).toContain("/usr/bin");
            expect(paths).not.toContain("/workspace/node_modules/.bin");
            expect(paths).not.toContain("/tmp/attacker");
            expect(paths).not.toContain("/home/user/.ssh/bin");
            expect(paths).not.toContain("relative/bin");
        }
        expect((await createToolEnvironment("full_access", environment)).PATH).toBe(
            environment.PATH,
        );
    });
});
