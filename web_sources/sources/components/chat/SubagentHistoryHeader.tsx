import { ArrowLeftIcon, GitForkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface SubagentHistoryHeaderProps {
    depth: number;
    description: string;
    onBack: () => void;
}

export function SubagentHistoryHeader(props: SubagentHistoryHeaderProps) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
            <Button
                aria-label="Back to the parent conversation"
                className="shrink-0"
                onClick={props.onBack}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <ArrowLeftIcon className="size-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2.5">
                <GitForkIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{props.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                        Subagent history · Level {props.depth}
                    </p>
                </div>
            </div>
        </header>
    );
}
