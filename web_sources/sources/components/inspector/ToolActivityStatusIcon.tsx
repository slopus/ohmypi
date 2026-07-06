import { CircleCheck, CircleSlash, CircleX, LoaderCircle } from "lucide-react";

import type { ToolActivityStatus } from "./collectToolActivity";

/** Status glyph for a tool activity entry. */
export function ToolActivityStatusIcon(props: { status: ToolActivityStatus }) {
    switch (props.status) {
        case "completed":
            return <CircleCheck aria-label="Completed" className="size-3.5 text-zinc-500" />;
        case "error":
            return <CircleX aria-label="Failed" className="size-3.5 text-red-400" />;
        case "interrupted":
            return <CircleSlash aria-label="Interrupted" className="size-3.5 text-zinc-500" />;
        case "running":
            return (
                <LoaderCircle
                    aria-label="Running"
                    className="size-3.5 animate-spin text-emerald-400"
                />
            );
    }
}
