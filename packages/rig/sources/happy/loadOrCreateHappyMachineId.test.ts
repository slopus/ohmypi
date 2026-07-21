import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadOrCreateHappyMachineId } from "./loadOrCreateHappyMachineId.js";

const directories: string[] = [];

afterEach(async () => {
    await Promise.all(
        directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
});

it("keeps one persistent Rig-only Happy machine identity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rig-happy-machine-"));
    directories.push(directory);
    const path = join(directory, "happy", "machine.json");

    expect(await loadOrCreateHappyMachineId(path, () => "rig-machine-1")).toBe("rig-machine-1");
    expect(await loadOrCreateHappyMachineId(path, () => "rig-machine-2")).toBe("rig-machine-1");
});

it("returns the persisted winner when daemons create the identity concurrently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rig-happy-machine-race-"));
    directories.push(directory);
    const path = join(directory, "happy", "machine.json");

    const identities = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
            loadOrCreateHappyMachineId(path, () => `rig-machine-${String(index)}`),
        ),
    );

    expect(new Set(identities).size).toBe(1);
    expect(identities[0]).toMatch(/^rig-machine-/u);
});
