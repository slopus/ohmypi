import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import lockfile from "proper-lockfile";

import { writeHappyJsonFile } from "./writeHappyJsonFile.js";

export async function loadOrCreateHappyMachineId(
    path: string,
    createId: () => string = randomUUID,
): Promise<string | undefined> {
    const existing = await readMachineId(path);
    if (existing !== undefined) return existing;
    try {
        await mkdir(dirname(path), { mode: 0o700, recursive: true });
    } catch {
        return undefined;
    }
    let release: (() => Promise<void>) | undefined;
    try {
        release = await lockfile.lock(path, {
            realpath: false,
            retries: { factor: 1.2, maxTimeout: 50, minTimeout: 10, retries: 20 },
        });
        const winner = await readMachineId(path);
        if (winner !== undefined) return winner;
        const id = createId();
        await writeHappyJsonFile(path, { id });
        return id;
    } catch {
        return undefined;
    } finally {
        await release?.().catch(() => undefined);
    }
}

async function readMachineId(path: string): Promise<string | undefined> {
    try {
        const stored = JSON.parse(await readFile(path, "utf8")) as unknown;
        if (
            typeof stored === "object" &&
            stored !== null &&
            !Array.isArray(stored) &&
            typeof (stored as { id?: unknown }).id === "string" &&
            (stored as { id: string }).id.trim().length > 0
        ) {
            return (stored as { id: string }).id.trim();
        }
    } catch {
        // A missing or malformed identity is replaced atomically by the lock holder.
    }
    return undefined;
}
