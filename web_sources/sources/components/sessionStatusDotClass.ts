import type { SessionStatus } from "@/protocol";

const STATUS_DOT_CLASS: Record<SessionStatus, string> = {
    aborted: "bg-amber-400",
    completed: "bg-zinc-400",
    error: "bg-red-400",
    idle: "bg-zinc-500",
    queued: "bg-emerald-400/70 animate-pulse",
    running: "bg-emerald-400 animate-pulse",
};

/**
 * The single source of truth for session status dot colors, shared by the
 * sidebar dot and the inspector badge so both panels always agree.
 */
export function sessionStatusDotClass(status: SessionStatus): string {
    return STATUS_DOT_CLASS[status];
}
