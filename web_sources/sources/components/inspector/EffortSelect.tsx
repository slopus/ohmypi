import { useState } from "react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { humanizeEffort } from "./humanizeEffort";

const MODEL_DEFAULT_VALUE = "__model-default__";

export interface EffortSelectProps {
    /** Disables the control. */
    disabled: boolean;
    /** Current session effort; undefined means the model default applies. */
    effort: string | undefined;
    /** Thinking levels supported by the current model. */
    levels: readonly string[];
    /** Called with the new effort (undefined = model default). */
    onChangeEffort: (effort: string | undefined) => Promise<void>;
}

/** Reasoning-effort picker for the Details tab, wired to the PATCH effort endpoint. */
export function EffortSelect(props: EffortSelectProps) {
    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const currentValue = props.effort ?? MODEL_DEFAULT_VALUE;

    const handleChange = (value: string) => {
        if (value === currentValue) {
            return;
        }
        setIsPending(true);
        setErrorMessage(undefined);
        props
            .onChangeEffort(value === MODEL_DEFAULT_VALUE ? undefined : value)
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error ? error.message : "The effort could not be changed.",
                );
            })
            .finally(() => {
                setIsPending(false);
            });
    };

    const hasLevels = props.levels.length > 0;

    return (
        <div className="flex flex-col gap-1">
            <Select
                disabled={props.disabled || isPending || !hasLevels}
                onValueChange={handleChange}
                value={currentValue}
            >
                <SelectTrigger className="h-8 w-full text-xs" size="sm">
                    <SelectValue
                        placeholder={
                            props.effort !== undefined
                                ? humanizeEffort(props.effort)
                                : "Model default"
                        }
                    />
                </SelectTrigger>
                <SelectContent position="popper">
                    <SelectItem value={MODEL_DEFAULT_VALUE}>Model default</SelectItem>
                    {props.levels.map((level) => (
                        <SelectItem key={level} value={level}>
                            {humanizeEffort(level)}
                        </SelectItem>
                    ))}
                    {props.effort !== undefined && !props.levels.includes(props.effort) && (
                        <SelectItem value={props.effort}>{humanizeEffort(props.effort)}</SelectItem>
                    )}
                </SelectContent>
            </Select>
            {errorMessage !== undefined && <p className="text-xs text-red-400">{errorMessage}</p>}
        </div>
    );
}
