import { SessionStatusDot } from "@/components/sidebar/SessionStatusDot";
import { formatRelativeTime } from "@/formatRelativeTime";
import { humanizeModelId } from "@/humanizeModelId";
import { humanizeSessionStatus } from "@/humanizeSessionStatus";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/protocol";

export interface SessionListRowProps {
    isActive: boolean;
    onSelect: () => void;
    session: SessionSummary;
}

/** Compact two-line session row for the sidebar list. */
export function SessionListRow(props: SessionListRowProps) {
    const { session } = props;
    const title = session.title ?? "Untitled session";

    return (
        <button
            type="button"
            onClick={props.onSelect}
            title={`${title} — ${humanizeSessionStatus(session.status)}`}
            className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring/60",
                props.isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/90 hover:bg-accent/50",
            )}
        >
            <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] leading-5 font-medium">{title}</span>
                <span className="shrink-0 text-[11px] leading-5 text-muted-foreground">
                    {formatRelativeTime(session.lastMessageAt ?? session.updatedAt)}
                </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
                <SessionStatusDot status={session.status} />
                <span className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground">
                    {humanizeModelId(session.modelId)}
                </span>
            </div>
        </button>
    );
}
