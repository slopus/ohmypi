import type { ReactNode } from "react";

/** Labeled row used by the Details tab. */
export function DetailField(props: { children: ReactNode; label: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
                {props.label}
            </span>
            {props.children}
        </div>
    );
}
