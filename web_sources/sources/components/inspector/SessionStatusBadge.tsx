import { sessionStatusDotClass } from "@/components/sessionStatusDotClass";
import { Badge } from "@/components/ui/badge";
import { humanizeSessionStatus } from "@/humanizeSessionStatus";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/protocol";

/** Compact outline badge with a colored status dot and readable label. */
export function SessionStatusBadge(props: { status: SessionStatus }) {
    return (
        <Badge variant="outline" className="gap-1.5 border-border/80 text-muted-foreground">
            <span
                aria-hidden
                className={cn("size-1.5 rounded-full", sessionStatusDotClass(props.status))}
            />
            {humanizeSessionStatus(props.status)}
        </Badge>
    );
}
