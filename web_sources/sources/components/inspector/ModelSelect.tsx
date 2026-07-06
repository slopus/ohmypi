import { useState } from "react";

import { ModelCatalogOptions } from "@/components/ModelCatalogOptions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { humanizeModelId } from "@/humanizeModelId";
import type { ModelCatalog } from "@/protocol";

export interface ModelSelectProps {
    /** Model catalog from health; when missing the select is disabled. */
    catalog: ModelCatalog | undefined;
    /** Disables the control (e.g. model locked or a run in flight). */
    disabled: boolean;
    /** Currently selected model id. */
    modelId: string;
    /** Called with the new model id; rejection is surfaced inline. */
    onChangeModel: (modelId: string) => Promise<void>;
}

/** Model picker for the Details tab, wired to the PATCH model endpoint. */
export function ModelSelect(props: ModelSelectProps) {
    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const providers = props.catalog?.providers ?? [];
    const knownIds = new Set(
        providers.flatMap((provider) => provider.models.map((model) => model.id)),
    );

    const handleChange = (modelId: string) => {
        if (modelId === props.modelId) {
            return;
        }
        setIsPending(true);
        setErrorMessage(undefined);
        props
            .onChangeModel(modelId)
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error ? error.message : "The model could not be changed.",
                );
            })
            .finally(() => {
                setIsPending(false);
            });
    };

    return (
        <div className="flex flex-col gap-1">
            <Select
                disabled={props.disabled || isPending || props.catalog === undefined}
                onValueChange={handleChange}
                value={props.modelId}
            >
                <SelectTrigger className="h-8 w-full font-mono text-xs" size="sm">
                    <SelectValue placeholder={humanizeModelId(props.modelId)} />
                </SelectTrigger>
                <SelectContent position="popper">
                    {props.catalog !== undefined && <ModelCatalogOptions catalog={props.catalog} />}
                    {!knownIds.has(props.modelId) && (
                        <SelectItem value={props.modelId}>
                            {humanizeModelId(props.modelId)}
                        </SelectItem>
                    )}
                </SelectContent>
            </Select>
            {errorMessage !== undefined && <p className="text-xs text-red-400">{errorMessage}</p>}
        </div>
    );
}
