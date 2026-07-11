import { cn } from "@/lib/utils";
import type { HealthResponse } from "@/protocol";

export interface DaemonHealthFooterProps {
    /** Last successful health response, if any. */
    health: HealthResponse | undefined;
    /** Error from the health poll (daemon unreachable), if any. */
    healthError: string | undefined;
}

interface DaemonHealthDisplay {
    dotClass: string;
    label: string;
}

function resolveDaemonHealthDisplay(props: DaemonHealthFooterProps): DaemonHealthDisplay {
    // The poll error is the freshest signal: a stale successful response must
    // not keep showing "Daemon ready" after the daemon went away.
    if (props.healthError !== undefined) {
        return { dotClass: "bg-red-400", label: "Daemon unreachable" };
    }
    if (props.health?.ready === true) {
        return { dotClass: "bg-emerald-400", label: "Daemon ready" };
    }
    if (props.health?.status === "error") {
        return {
            dotClass: "bg-red-400",
            label: props.health.errorMessage ?? "Daemon failed to start",
        };
    }
    return { dotClass: "bg-amber-400 animate-pulse", label: "Daemon starting…" };
}

/** Sidebar footer showing daemon readiness with a status dot. */
export function DaemonHealthFooter(props: DaemonHealthFooterProps) {
    const display = resolveDaemonHealthDisplay(props);

    return (
        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
            <span
                aria-hidden="true"
                className={cn("size-1.5 shrink-0 rounded-full", display.dotClass)}
            />
            <span
                className="min-w-0 truncate text-xs text-muted-foreground"
                title={props.healthError ?? props.health?.errorMessage}
            >
                {display.label}
            </span>
        </div>
    );
}
