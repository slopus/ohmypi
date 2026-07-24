import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { rotateDaemonLog } from "./rotateDaemonLog.js";

const roots = new Set<string>();

afterEach(async () => {
    await Promise.all([...roots].map((root) => rm(root, { force: true, recursive: true })));
    roots.clear();
});

describe("rotateDaemonLog", () => {
    it("keeps a small current log in place", async () => {
        const root = await createRoot();
        const path = join(root, "server.log");
        await writeFile(path, "current");

        await rotateDaemonLog(path, 8);

        await expect(readFile(path, "utf8")).resolves.toBe("current");
        await expect(stat(join(root, "server.previous.log"))).rejects.toMatchObject({
            code: "ENOENT",
        });
    });

    it("moves an oversized current log to one replaceable previous log", async () => {
        const root = await createRoot();
        const path = join(root, "server.log");
        const previous = join(root, "server.previous.log");
        await writeFile(path, "oversized");
        await writeFile(previous, "older");

        await rotateDaemonLog(path, 8);

        await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(readFile(previous, "utf8")).resolves.toBe("oversized");
    });
});

async function createRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "rig-daemon-log-"));
    roots.add(root);
    return root;
}
