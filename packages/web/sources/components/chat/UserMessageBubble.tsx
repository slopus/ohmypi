import { Message, MessageContent } from "@/components/ai/message";
import { RewindMessageButton } from "@/components/chat/RewindMessageButton";
import type { ImageBlock, UserMessage } from "@/protocol";

export interface UserMessageBubbleProps {
    message: UserMessage;
    onRewind: () => Promise<void>;
    rewindDisabled: boolean;
}

/**
 * Right-aligned user bubble: image thumbnails (when the message carries
 * ImageBlocks) above the text. Optimistic messages (not yet echoed by the
 * server) render slightly dimmed.
 */
export function UserMessageBubble({ message, onRewind, rewindDisabled }: UserMessageBubbleProps) {
    const isOptimistic = message.id.startsWith("optimistic-");
    const images = message.blocks.filter((block): block is ImageBlock => block.type === "image");
    const text = message.blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");

    return (
        <Message className={isOptimistic ? "opacity-70" : undefined} from="user">
            {images.length > 0 && (
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                    {images.map((image, index) => (
                        <img
                            alt={`Attached image ${index + 1}`}
                            className="size-24 rounded-lg border object-cover"
                            key={index}
                            src={`data:${image.mediaType};base64,${image.data}`}
                        />
                    ))}
                </div>
            )}
            {text !== "" && (
                <MessageContent>
                    <span className="whitespace-pre-wrap break-words">{text}</span>
                </MessageContent>
            )}
            {!isOptimistic && (
                <div className="ml-auto h-6">
                    <RewindMessageButton
                        disabled={rewindDisabled}
                        hasAttachments={images.length > 0}
                        onRewind={onRewind}
                    />
                </div>
            )}
        </Message>
    );
}
