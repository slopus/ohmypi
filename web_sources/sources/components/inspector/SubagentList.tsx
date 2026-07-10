import { ChevronRightIcon, GitForkIcon } from "lucide-react";

import { SessionStatusDot } from "@/components/sidebar/SessionStatusDot";
import { humanizeModelId } from "@/humanizeModelId";
import type { SubagentSummary } from "@/protocol";

export interface SubagentListProps {
    onOpenSubagent: (sessionId: string) => void;
    subagents: readonly SubagentSummary[];
}

export function SubagentList(props: SubagentListProps) {
    if (props.subagents.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <GitForkIcon className="size-3.5" />
                <h3 className="text-xs font-medium uppercase tracking-wide">Delegated work</h3>
            </div>
            <div className="overflow-hidden rounded-md border border-border/60">
                {props.subagents.map((subagent) => (
                    <button
                        className="group flex w-full items-center gap-2.5 border-border/60 border-b px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent/50"
                        key={subagent.id}
                        onClick={() => props.onOpenSubagent(subagent.id)}
                        type="button"
                    >
                        <SessionStatusDot status={subagent.status} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-foreground/90">
                                {subagent.description}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                                Level {subagent.depth} · {humanizeModelId(subagent.modelId)}
                            </span>
                        </span>
                        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                ))}
            </div>
        </div>
    );
}
