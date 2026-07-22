import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const checker = fileURLToPath(new URL("./check-trusted-publisher.mjs", import.meta.url));

function check(value: string): number | null {
    return spawnSync(process.execPath, [checker], { input: value }).status;
}

test("identifies a missing trusted publisher", () => {
    expect(check("")).toBe(2);
});

test("accepts the exact Rig release trust", () => {
    expect(
        check(
            JSON.stringify({
                environment: "npm",
                file: "publish-rig-codemode-codex.yml",
                permissions: ["createPackage"],
                repository: "slopus/rig",
                type: "github",
            }),
        ),
    ).toBe(0);
});

test("rejects an existing publisher for another repository", () => {
    expect(
        check(
            JSON.stringify({
                environment: "npm",
                file: "publish-rig-codemode-codex.yml",
                permissions: ["createPackage"],
                repository: "slopus/ohmypi",
                type: "github",
            }),
        ),
    ).toBe(3);
});

test("rejects required strings stored in unrelated fields", () => {
    expect(
        check(
            JSON.stringify({
                environment: "production",
                file: "other.yml",
                note: "slopus/rig publish-rig-codemode-codex.yml npm createPackage",
                permissions: ["createStagedPackage"],
                repository: "slopus/ohmypi",
                type: "github",
            }),
        ),
    ).toBe(3);
});

test.each([
    ["another provider", { type: "gitlab" }],
    ["another workflow", { file: "publish.yml" }],
    ["another environment", { environment: "production" }],
    ["stage-only permission", { permissions: ["createStagedPackage"] }],
    ["additional permission", { permissions: ["createPackage", "createStagedPackage"] }],
    ["near-match repository", { repository: "slopus/rig-fork" }],
])("rejects %s", (_label, override) => {
    expect(
        check(
            JSON.stringify({
                environment: "npm",
                file: "publish-rig-codemode-codex.yml",
                permissions: ["createPackage"],
                repository: "slopus/rig",
                type: "github",
                ...override,
            }),
        ),
    ).toBe(3);
});

test("rejects multiple records even if their fields combine into a match", () => {
    expect(
        check(
            JSON.stringify([
                {
                    environment: "npm",
                    file: "publish-rig-codemode-codex.yml",
                    permissions: ["createStagedPackage"],
                    repository: "slopus/rig",
                    type: "github",
                },
                {
                    permissions: ["createPackage"],
                    repository: "slopus/other",
                    type: "github",
                },
            ]),
        ),
    ).toBe(3);
});
