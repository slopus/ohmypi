import { describe, expect, it } from "vitest";

import { resolveFileSystemPath } from "./resolveFileSystemPath.js";

describe("resolveFileSystemPath", () => {
    it("resolves relative, absolute, and home-relative paths consistently", () => {
        expect(resolveFileSystemPath("src/index.ts", "/workspace", "/home/rig")).toBe(
            "/workspace/src/index.ts",
        );
        expect(resolveFileSystemPath("/tmp/input.txt", "/workspace", "/home/rig")).toBe(
            "/tmp/input.txt",
        );
        expect(resolveFileSystemPath("~", "/workspace", "/home/rig")).toBe("/home/rig");
        expect(resolveFileSystemPath("~/input.txt", "/workspace", "/home/rig")).toBe(
            "/home/rig/input.txt",
        );
    });

    it("rejects home-relative paths when the execution environment has no home", () => {
        expect(() => resolveFileSystemPath("~/input.txt", "/workspace")).toThrow(
            "home-relative paths are unavailable",
        );
    });
});
