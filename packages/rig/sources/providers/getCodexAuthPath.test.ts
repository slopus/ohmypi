import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getCodexAuthPath } from "./getCodexAuthPath.js";

describe("getCodexAuthPath", () => {
    it("uses auth_file before CODEX_HOME", () => {
        expect(
            getCodexAuthPath({
                authFile: "/configured/auth.json",
                env: { CODEX_HOME: "/environment/codex" },
            }),
        ).toBe("/configured/auth.json");
    });

    it("resolves auth.json inside CODEX_HOME", () => {
        expect(getCodexAuthPath({ env: { CODEX_HOME: "/environment/codex" } })).toBe(
            "/environment/codex/auth.json",
        );
    });

    it("defaults to the standard Codex directory", () => {
        expect(getCodexAuthPath({ env: {} })).toBe(join(homedir(), ".codex", "auth.json"));
    });
});
