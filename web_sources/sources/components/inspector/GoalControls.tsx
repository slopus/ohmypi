import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GoalStatus, SessionGoal } from "@/protocol";

export interface GoalControlsProps {
    changeStatus: (status: GoalStatus) => Promise<void>;
    clear: () => Promise<void>;
    goal: SessionGoal | undefined;
    set: (objective: string) => Promise<void>;
}

export function GoalControls(props: GoalControlsProps) {
    const [objective, setObjective] = useState("");
    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const run = (action: () => Promise<void>) => {
        setIsPending(true);
        setErrorMessage(undefined);
        void action()
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error ? error.message : "The goal could not be updated.",
                );
            })
            .finally(() => setIsPending(false));
    };

    if (props.goal === undefined) {
        return (
            <div className="space-y-2">
                <Textarea
                    aria-label="Goal objective"
                    disabled={isPending}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="Describe the outcome to pursue across turns"
                    rows={3}
                    value={objective}
                />
                <Button
                    className="w-full"
                    disabled={isPending || objective.trim().length === 0}
                    onClick={() => run(() => props.set(objective).then(() => setObjective("")))}
                    size="sm"
                >
                    Start goal
                </Button>
                {errorMessage !== undefined && (
                    <p className="text-xs leading-relaxed text-destructive">{errorMessage}</p>
                )}
            </div>
        );
    }

    const canResume = props.goal.status === "paused" || props.goal.status === "blocked";
    return (
        <div className="space-y-2">
            <div className="rounded-md border border-border/60 px-2.5 py-2">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    {goalStatusLabel(props.goal.status)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/90">
                    {props.goal.objective}
                </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {props.goal.status === "active" && (
                    <Button
                        disabled={isPending}
                        onClick={() => run(() => props.changeStatus("paused"))}
                        size="sm"
                        variant="outline"
                    >
                        Pause
                    </Button>
                )}
                {canResume && (
                    <Button
                        disabled={isPending}
                        onClick={() => run(() => props.changeStatus("active"))}
                        size="sm"
                        variant="outline"
                    >
                        Resume
                    </Button>
                )}
                <Button
                    className={props.goal.status === "complete" ? "col-span-2" : undefined}
                    disabled={isPending}
                    onClick={() => run(props.clear)}
                    size="sm"
                    variant="ghost"
                >
                    Clear
                </Button>
            </div>
            {errorMessage !== undefined && (
                <p className="text-xs leading-relaxed text-destructive">{errorMessage}</p>
            )}
        </div>
    );
}

function goalStatusLabel(status: GoalStatus): string {
    if (status === "active") return "Active";
    if (status === "paused") return "Paused";
    if (status === "blocked") return "Blocked";
    return "Complete";
}
