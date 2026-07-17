import { createKimiRequestHeaders } from "./createKimiRequestHeaders.js";
import { getKimiAuthPath } from "./getKimiAuthPath.js";
import { getKimiHome } from "./getKimiHome.js";
import { isKimiAuthExpired } from "./isKimiAuthExpired.js";
import type {
    KimiAuthRecord,
    KimiCredential,
    ResolveKimiCredentialOptions,
} from "./kimi-auth-types.js";
import { readKimiAuthRecord } from "./readKimiAuthRecord.js";
import { refreshKimiAuthRecord } from "./refreshKimiAuthRecord.js";
import { withKimiAuthRefreshLock } from "./withKimiAuthRefreshLock.js";
import { writeKimiAuthRecord } from "./writeKimiAuthRecord.js";

const activeRefreshes = new Map<string, { force: boolean; promise: Promise<KimiCredential> }>();

export async function resolveKimiCredential(
    options: ResolveKimiCredentialOptions = {},
): Promise<KimiCredential> {
    const apiKey = options.apiKey?.trim();
    if (apiKey) return { source: "api-key", token: apiKey };
    const env = options.env ?? process.env;
    const envApiKey = env.KIMI_API_KEY?.trim();
    if (envApiKey) return { source: "api-key", token: envApiKey };

    const authPath = getKimiAuthPath({
        ...(options.authFile === undefined ? {} : { authFile: options.authFile }),
        env,
    });
    // The shared Kimi Code home coordinates refresh with the official CLI; a
    // custom auth file is rig-private and locks in place instead.
    const kimiHome = options.authFile?.trim() ? undefined : getKimiHome(env);
    const record = await readKimiAuthRecord(authPath);
    if (record === undefined || record.access_token.length === 0) {
        throw new Error("Kimi Code is not signed in. Run `kimi login`.");
    }
    const now = Math.floor((options.now?.() ?? Date.now()) / 1_000);
    const force = options.force === true;
    if (!isKimiAuthExpired(record, { force, now })) {
        return { source: "session", token: record.access_token };
    }

    const current = activeRefreshes.get(authPath);
    if (current !== undefined) {
        if (!force || current.force) return current.promise;
        await current.promise.catch(() => undefined);
        return resolveKimiCredential(options);
    }
    const promise = refreshCredential({
        authPath,
        env,
        fetch: options.fetch ?? globalThis.fetch,
        force,
        kimiHome,
        now,
        record,
    }).finally(() => {
        if (activeRefreshes.get(authPath)?.promise === promise) activeRefreshes.delete(authPath);
    });
    activeRefreshes.set(authPath, { force, promise });
    return promise;
}

async function refreshCredential(options: {
    authPath: string;
    env: NodeJS.ProcessEnv;
    fetch: typeof globalThis.fetch;
    force: boolean;
    kimiHome: string | undefined;
    now: number;
    record: KimiAuthRecord;
}): Promise<KimiCredential> {
    return withKimiAuthRefreshLock(
        { authPath: options.authPath, kimiHome: options.kimiHome },
        async () => {
            const latest = (await readKimiAuthRecord(options.authPath)) ?? options.record;
            const changed =
                latest.access_token !== options.record.access_token ||
                latest.refresh_token !== options.record.refresh_token ||
                latest.expires_at !== options.record.expires_at;
            if (
                (options.force && changed) ||
                !isKimiAuthExpired(latest, { force: options.force, now: options.now })
            ) {
                return { source: "session", token: latest.access_token };
            }
            const refreshed = await refreshKimiAuthRecord({
                env: options.env,
                fetch: options.fetch,
                headers: createKimiRequestHeaders({
                    env: options.env,
                    kimiHome: getKimiHome(options.env),
                }),
                now: options.now,
                record: latest,
            });
            await writeKimiAuthRecord(options.authPath, refreshed);
            return { source: "session", token: refreshed.access_token };
        },
    );
}
