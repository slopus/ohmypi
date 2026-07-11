import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { resolvePortlessCliPath } from "./resolvePortlessCliPath.js";

describe("resolvePortlessCliPath", () => {
    it("resolves the Portless CLI without importing the package root", async () => {
        const cliPath = await resolvePortlessCliPath();

        await expect(access(cliPath)).resolves.toBeUndefined();
        expect(cliPath).toContain("portless");
        expect(cliPath).toMatch(/dist\/cli\.js$/u);
    });
});
