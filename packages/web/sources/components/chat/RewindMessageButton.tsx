import { HistoryIcon } from "lucide-react";
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

export interface RewindMessageButtonProps {
    disabled: boolean;
    hasAttachments: boolean;
    onRewind: () => Promise<void>;
}

export function RewindMessageButton(props: RewindMessageButtonProps) {
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const handleConfirm = () => {
        setErrorMessage(undefined);
        setIsPending(true);
        props
            .onRewind()
            .then(() => setIsOpen(false))
            .catch((error: unknown) => {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "The conversation could not be rewound.",
                );
            })
            .finally(() => setIsPending(false));
    };

    return (
        <Dialog
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) setErrorMessage(undefined);
            }}
            open={isOpen}
        >
            <DialogTrigger asChild>
                <Button
                    aria-label="Rewind to this message"
                    className="opacity-60 transition-opacity hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    disabled={props.disabled}
                    size="icon-xs"
                    title="Rewind to this message"
                    variant="ghost"
                >
                    <HistoryIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Rewind to this message?</DialogTitle>
                    <DialogDescription>
                        This message and everything after it will be removed from the conversation.
                        Its text will return to the composer, and files in the working directory
                        will stay unchanged.
                        {props.hasAttachments
                            ? " Attachments are not restored and will need to be added again."
                            : ""}
                    </DialogDescription>
                </DialogHeader>
                {errorMessage !== undefined && (
                    <p className="text-destructive text-sm">{errorMessage}</p>
                )}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button disabled={isPending} size="sm" variant="ghost">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button disabled={isPending} onClick={handleConfirm} size="sm">
                        {isPending ? "Rewinding…" : "Rewind conversation"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
