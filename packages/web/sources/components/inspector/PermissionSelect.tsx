import { useState } from "react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { PermissionMode } from "@/protocol";
import { permissionModeOptions } from "@/permissionModeOptions";

export interface PermissionSelectProps {
    disabled: boolean;
    onChangePermissionMode: (permissionMode: PermissionMode) => Promise<void>;
    permissionMode: PermissionMode;
}

export function PermissionSelect(props: PermissionSelectProps) {
    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const selected = permissionModeOptions.find((option) => option.value === props.permissionMode);

    const handleChange = (value: PermissionMode) => {
        if (value === props.permissionMode) return;
        setIsPending(true);
        setErrorMessage(undefined);
        props
            .onChangePermissionMode(value)
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "The permission mode could not be changed.",
                );
            })
            .finally(() => setIsPending(false));
    };

    return (
        <div className="flex flex-col gap-1.5">
            <Select
                disabled={props.disabled || isPending}
                onValueChange={(value) => handleChange(value as PermissionMode)}
                value={props.permissionMode}
            >
                <SelectTrigger className="h-8 w-full text-xs" size="sm">
                    <SelectValue placeholder={selected?.label ?? "Workspace write"} />
                </SelectTrigger>
                <SelectContent position="popper">
                    {permissionModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
                {selected?.description ?? "Writes stay in the working directory."}
            </p>
            {errorMessage !== undefined && <p className="text-xs text-red-400">{errorMessage}</p>}
        </div>
    );
}
