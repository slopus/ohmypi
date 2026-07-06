import { sessionStatusDotClass } from "@/components/sessionStatusDotClass";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/protocol";

export interface SessionStatusDotProps {
    className?: string;
    status: SessionStatus;
}

/** Small colored dot conveying a session's run status. */
export function SessionStatusDot(props: SessionStatusDotProps) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                sessionStatusDotClass(props.status),
                props.className,
            )}
        />
    );
}
