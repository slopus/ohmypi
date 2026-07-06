import { ChevronRight } from "lucide-react";

import type { ToolActivityEntry } from "./collectToolActivity";
import { ToolActivityStatusIcon } from "./ToolActivityStatusIcon";

export interface ToolActivityRowProps {
    entry: ToolActivityEntry;
    onSelect: (toolCallId: string) => void;
}

/** One row in the Activity tab: status icon, tool name, display summary. */
export function ToolActivityRow(props: ToolActivityRowProps) {
    const { entry } = props;
    const summary =
        entry.result !== undefined && entry.result.display !== ""
            ? entry.result.display
            : entry.status === "running"
              ? "Running…"
              : undefined;

    return (
        <button
            className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => props.onSelect(entry.id)}
            type="button"
        >
            <span className="mt-0.5 shrink-0">
                <ToolActivityStatusIcon status={entry.status} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-xs text-foreground/90">{entry.name}</span>
                {summary !== undefined && (
                    <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {summary}
                    </span>
                )}
            </span>
            <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </button>
    );
}
