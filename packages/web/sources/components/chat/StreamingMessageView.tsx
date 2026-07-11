import { Message, MessageContent } from "@/components/ai/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai/reasoning";
import { Response } from "@/components/ai/response";
import { ToolCallView } from "@/components/chat/ToolCallView";
import type { AssistantMessage } from "@/protocol";

export interface StreamingMessageViewProps {
    /** Live partial assistant message from the stream. */
    partial: AssistantMessage;
}

/**
 * The in-progress assistant message rendered from streamingPartial: text
 * streams through Response, thinking streams inside an open Reasoning section,
 * and tool calls show their arguments as they arrive. The finalized
 * agent_message event replaces this view.
 */
export function StreamingMessageView({ partial }: StreamingMessageViewProps) {
    const lastIndex = partial.content.length - 1;

    return (
        <Message from="assistant">
            <MessageContent className="w-full gap-3">
                {partial.content.map((content, index) => {
                    const isCurrent = index === lastIndex;
                    switch (content.type) {
                        case "text": {
                            return <Response key={index}>{content.text}</Response>;
                        }
                        case "thinking": {
                            return (
                                <Reasoning
                                    className="mb-0"
                                    defaultOpen={isCurrent}
                                    isStreaming={isCurrent}
                                    key={index}
                                >
                                    <ReasoningTrigger />
                                    <ReasoningContent>{content.thinking}</ReasoningContent>
                                </Reasoning>
                            );
                        }
                        case "toolCall": {
                            return (
                                <ToolCallView
                                    args={content.arguments}
                                    isStreamingArgs={isCurrent}
                                    key={content.id !== "" ? content.id : index}
                                    name={content.name}
                                    result={undefined}
                                />
                            );
                        }
                    }
                })}
            </MessageContent>
        </Message>
    );
}
