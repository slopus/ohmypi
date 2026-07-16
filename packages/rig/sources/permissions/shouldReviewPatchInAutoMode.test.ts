import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createJustBashToolHarness } from "../tools/testing/createJustBashToolHarness.js";
import { shouldReviewPatchInAutoMode } from "./shouldReviewPatchInAutoMode.js";

describe("shouldReviewPatchInAutoMode", () => {
    it("reviews the full executor path when it contains a Unicode line separator", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-patch-review-"));
        try {
            const harness = createJustBashToolHarness({ cwd });
            const patch = [
                "*** Begin Patch",
                "*** Add File: safe\u2028../../../outside.txt",
                "+outside",
                "*** End Patch",
            ].join("\n");

            await expect(shouldReviewPatchInAutoMode({ patch }, harness.context)).resolves.toBe(
                true,
            );
        } finally {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("fails closed when an affected path cannot be resolved", async () => {
        const cwd = await mkdtemp(join(tmpdir(), "rig-patch-review-"));
        try {
            const harness = createJustBashToolHarness({ cwd });
            const patch = [
                "*** Begin Patch",
                "*** Add File: ~/outside.txt",
                "+outside",
                "*** End Patch",
            ].join("\n");

            await expect(shouldReviewPatchInAutoMode({ patch }, harness.context)).resolves.toBe(
                true,
            );
        } finally {
            await rm(cwd, { force: true, recursive: true });
        }
    });
});
