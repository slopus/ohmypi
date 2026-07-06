import { Wrench } from "lucide-react";
import { useState } from "react";

import type { ToolActivityEntry } from "./collectToolActivity";
import { ToolActivityDetail } from "./ToolActivityDetail";
import { ToolActivityRow } from "./ToolActivityRow";

export interface ActivityTabProps {
    entries: readonly ToolActivityEntry[];
}

/** The Activity tab: chronological tool-call list with an in-panel detail view. */
export function ActivityTab(props: ActivityTabProps) {
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

    const selected = props.entries.find((entry) => entry.id === selectedId);

    if (selected !== undefined) {
        return (
            <ToolActivityDetail
                entry={selected}
                onBack={() => {
                    setSelectedId(undefined);
                }}
            />
        );
    }

    if (props.entries.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <Wrench className="size-5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                    Tool calls made by the agent will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5 p-2">
            {props.entries.map((entry) => (
                <ToolActivityRow entry={entry} key={entry.id} onSelect={setSelectedId} />
            ))}
        </div>
    );
}
