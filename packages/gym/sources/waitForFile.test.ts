import { describe, expect, it, vi } from "vitest";

import { waitForFile } from "./waitForFile.js";

describe("waitForFile", () => {
    it("waits inside the container with the path passed as a positional argument", async () => {
        const runInContainer = vi.fn().mockResolvedValue({ stderr: "", stdout: "" });
        const gym = { runInContainer };

        await waitForFile(gym, "/workspace/proof file", 12_345);

        expect(runInContainer).toHaveBeenCalledWith(
            "sh",
            [
                "-c",
                'while [ ! -e "$1" ]; do sleep 0.05; done',
                "wait-for-file",
                "/workspace/proof file",
            ],
            { timeoutMs: 12_345 },
        );
    });
});
