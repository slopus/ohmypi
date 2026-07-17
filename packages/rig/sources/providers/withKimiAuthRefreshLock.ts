import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import lockfile from "proper-lockfile";

export async function withKimiAuthRefreshLock<T>(
    options: { authPath: string; kimiHome: string | undefined },
    operation: () => Promise<T>,
): Promise<T> {
    // A shared Kimi Code home locks where the official CLI does; a custom auth
    // file is unknown to the CLI, so the file itself becomes the lock target.
    const kimiHome = options.kimiHome;
    const target = kimiHome === undefined ? options.authPath : join(kimiHome, "oauth", "kimi-code");
    if (kimiHome !== undefined) {
        await mkdir(join(kimiHome, "oauth"), { mode: 0o700, recursive: true });
        await writeFile(target, "", { flag: "a", mode: 0o600 });
    }
    const release = await lockfile.lock(target, {
        realpath: false,
        retries: { factor: 1, maxTimeout: 1_000, minTimeout: 500, retries: 120 },
        stale: 5_000,
    });
    try {
        return await operation();
    } finally {
        await release().catch(() => undefined);
    }
}
