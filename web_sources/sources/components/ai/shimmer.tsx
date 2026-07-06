import { cn } from "@/lib/utils";
import type { CSSProperties, ElementType } from "react";
import { createElement, memo, useMemo } from "react";

export type ShimmerProps = {
    children: string;
    as?: ElementType;
    className?: string;
    duration?: number;
    spread?: number;
};

// CSS-only adaptation of the AI Elements Shimmer (original uses motion/react).
// A gradient highlight sweeps across muted text via background-position animation.
const ShimmerComponent = ({
    children,
    as: Component = "p",
    className,
    duration = 2,
    spread = 2,
}: ShimmerProps) => {
    const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

    return createElement(
        Component,
        {
            className: cn(
                "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
                "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
                "animate-shimmer",
                className,
            ),
            style: {
                "--spread": `${dynamicSpread}px`,
                backgroundImage:
                    "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
                animationDuration: `${duration}s`,
            } as CSSProperties,
        },
        children,
    );
};

export const Shimmer = memo(ShimmerComponent);
