import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { resolveCodeModeBinary } from "./resolveCodeModeBinary.js";

describe("resolveCodeModeBinary", () => {
    test("accepts an explicit binary path", () => {
        const directory = mkdtempSync(path.join(tmpdir(), "codemode-resolver-"));
        const binary = path.join(directory, "host");
        writeFileSync(binary, "fixture");

        expect(resolveCodeModeBinary(binary)).toBe(binary);
    });

    test("rejects a missing explicit binary path", () => {
        expect(() => resolveCodeModeBinary("/definitely/missing/codemode-host")).toThrow(
            "does not exist",
        );
    });
});
