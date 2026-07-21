import type { BashContext, BashSessionSnapshot } from "../../agent/index.js";

const PROGRESS_POLL_MS = 100;
const MAX_PROGRESS_DISPLAY_CHARACTERS = 2_000;

export async function readSessionWithProgress(options: {
    bash: BashContext;
    onProgress?: (display: string) => void;
    sessionId: number;
    signal?: AbortSignal;
    waitMs?: number;
}): Promise<BashSessionSnapshot | undefined> {
    const deadline = options.waitMs === undefined ? undefined : Date.now() + options.waitMs;
    let stderrDelta = "";
    let stdoutDelta = "";
    let lastProgressDisplay = "";
    let snapshot: BashSessionSnapshot | undefined;

    do {
        const remaining =
            deadline === undefined ? PROGRESS_POLL_MS : Math.max(0, deadline - Date.now());
        snapshot = await options.bash.readSession(options.sessionId, {
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            waitMs: Math.min(PROGRESS_POLL_MS, remaining),
        });
        if (snapshot === undefined) return undefined;
        stdoutDelta += snapshot.stdoutDelta;
        stderrDelta += snapshot.stderrDelta;
        const progress = [stdoutDelta, stderrDelta].filter(Boolean).join("\n");
        const progressDisplay = progress.slice(0, MAX_PROGRESS_DISPLAY_CHARACTERS);
        if (progressDisplay.length > 0 && progressDisplay !== lastProgressDisplay) {
            lastProgressDisplay = progressDisplay;
            options.onProgress?.(progressDisplay);
        }
        if (
            snapshot.status !== "running" ||
            options.signal?.aborted ||
            (deadline !== undefined && remaining === 0)
        ) {
            break;
        }
    } while (deadline === undefined || Date.now() < deadline);

    return snapshot === undefined ? undefined : { ...snapshot, stderrDelta, stdoutDelta };
}
