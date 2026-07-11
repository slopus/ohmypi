import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export interface ResetConversationButtonProps {
    /** Disables the trigger (e.g. while a run is active). */
    disabled: boolean;
    /** Performs the reset; rejection is surfaced inside the dialog. */
    onReset: () => Promise<void>;
}

/** Reset-conversation button with a confirmation dialog. */
export function ResetConversationButton(props: ResetConversationButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setErrorMessage(undefined);
        }
    };

    const handleConfirm = () => {
        setIsPending(true);
        setErrorMessage(undefined);
        props
            .onReset()
            .then(() => {
                setIsOpen(false);
            })
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error ? error.message : "The conversation could not be reset.",
                );
            })
            .finally(() => {
                setIsPending(false);
            });
    };

    return (
        <Dialog onOpenChange={handleOpenChange} open={isOpen}>
            <DialogTrigger asChild>
                <Button
                    className="w-full justify-center gap-2"
                    disabled={props.disabled}
                    size="sm"
                    variant="outline"
                >
                    <RotateCcw className="size-3.5" />
                    Reset conversation
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Reset this conversation?</DialogTitle>
                    <DialogDescription>
                        All messages in this session will be cleared. The session itself, its
                        working directory, and its model settings are kept.
                    </DialogDescription>
                </DialogHeader>
                {errorMessage !== undefined && (
                    <p className="text-sm text-red-400">{errorMessage}</p>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button disabled={isPending} size="sm" variant="ghost">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        disabled={isPending}
                        onClick={handleConfirm}
                        size="sm"
                        variant="destructive"
                    >
                        {isPending ? "Resetting…" : "Reset conversation"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
