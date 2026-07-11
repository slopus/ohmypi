import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ToolActivityEntry } from "./collectToolActivity";
import { ToolActivityStatusIcon } from "./ToolActivityStatusIcon";

export interface ToolActivityDetailProps {
    entry: ToolActivityEntry;
    onBack: () => void;
}

function statusLabel(entry: ToolActivityEntry): string {
    switch (entry.status) {
        case "completed":
            return "Completed";
        case "error":
            return "Failed";
        case "interrupted":
            return "Interrupted";
        case "running":
            return "Running…";
    }
}

function formatArguments(value: unknown): string {
    if (value === undefined) {
        return "No arguments";
    }
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

/** Full argument/result view for one tool call, shown inside the Activity tab. */
export function ToolActivityDetail(props: ToolActivityDetailProps) {
    const { entry } = props;

    const resultText =
        entry.result?.rendered
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n") ?? "";
    const imageCount = entry.result?.rendered.filter((block) => block.type === "image").length ?? 0;

    return (
        <div className="flex flex-col gap-3 p-3">
            <div>
                <Button
                    className="-ml-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                    onClick={props.onBack}
                    size="sm"
                    variant="ghost"
                >
                    <ArrowLeft className="size-3.5" />
                    All activity
                </Button>
            </div>

            <div className="flex items-center gap-2 px-1">
                <ToolActivityStatusIcon status={entry.status} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
                    {entry.name}
                </span>
                <span
                    className={cn(
                        "text-xs",
                        entry.status === "error"
                            ? "text-red-400"
                            : entry.status === "running"
                              ? "text-emerald-400"
                              : "text-muted-foreground",
                    )}
                >
                    {statusLabel(entry)}
                </span>
            </div>

            <div className="flex flex-col gap-1 px-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">
                    Arguments
                </span>
                <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-zinc-900/60 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {formatArguments(entry.arguments)}
                </pre>
            </div>

            <div className="flex flex-col gap-1 px-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">
                    Result
                </span>
                {entry.result === undefined ? (
                    <p className="text-xs text-muted-foreground">
                        {entry.status === "running"
                            ? "Waiting for the tool to finish…"
                            : "No result was recorded."}
                    </p>
                ) : (
                    <>
                        {entry.result.display !== "" && (
                            <p
                                className={cn(
                                    "text-xs leading-snug",
                                    entry.result.isError === true
                                        ? "text-red-400"
                                        : "text-foreground/90",
                                )}
                            >
                                {entry.result.display}
                            </p>
                        )}
                        {resultText !== "" && (
                            <pre className="max-h-72 overflow-auto rounded-lg border border-border/60 bg-zinc-900/60 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                                {resultText}
                            </pre>
                        )}
                        {imageCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {imageCount === 1
                                    ? "The result includes 1 image."
                                    : `The result includes ${imageCount} images.`}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
