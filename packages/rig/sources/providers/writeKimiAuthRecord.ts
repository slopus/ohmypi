import { randomUUID } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { KimiAuthRecord } from "./kimi-auth-types.js";

export async function writeKimiAuthRecord(path: string, record: KimiAuthRecord): Promise<void> {
    await mkdir(dirname(path), { mode: 0o700, recursive: true });
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
        await chmod(temporaryPath, 0o600);
        await rename(temporaryPath, path);
    } finally {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
}
