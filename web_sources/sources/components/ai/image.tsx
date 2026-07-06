import { cn } from "@/lib/utils";

// Local replacement for the AI SDK Experimental_GeneratedImage type.
export type GeneratedImage = {
    base64: string;
    mediaType: string;
    uint8Array?: Uint8Array;
};

export type ImageProps = GeneratedImage & {
    className?: string;
    alt?: string;
};

export const Image = ({ base64, uint8Array: _uint8Array, mediaType, ...props }: ImageProps) => (
    <img
        {...props}
        alt={props.alt}
        className={cn("h-auto max-w-full overflow-hidden rounded-md", props.className)}
        src={`data:${mediaType};base64,${base64}`}
    />
);
