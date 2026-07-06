import { Image } from "@/components/ai/image";
import { Message, MessageContent } from "@/components/ai/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai/reasoning";
import { Response } from "@/components/ai/response";
import { ToolCallView } from "@/components/chat/ToolCallView";
import type { AgentBlock, AgentMessage, ToolResultBlock } from "@/protocol";

export interface AgentMessageViewProps {
    /** True while the session's run is active (idle result-less tool calls render as interrupted). */
    isSessionRunning: boolean;
    message: AgentMessage;
    /** tool_result blocks from the whole transcript, keyed by toolCallId. */
    toolResults: ReadonlyMap<string, ToolResultBlock>;
}

type VisibleAgentBlock = Exclude<AgentBlock, ToolResultBlock>;

/**
 * A finalized agent message: markdown text via Response, thinking blocks in a
 * collapsed Reasoning section, tool calls paired with their results. Messages
 * that only carry tool_result blocks render nothing (the result is shown on
 * the originating tool call instead).
 */
export function AgentMessageView({
    isSessionRunning,
    message,
    toolResults,
}: AgentMessageViewProps) {
    const visibleBlocks = message.blocks.filter(
        (block): block is VisibleAgentBlock => block.type !== "tool_result",
    );
    if (visibleBlocks.length === 0) {
        return null;
    }

    return (
        <Message from="assistant">
            <MessageContent className="w-full gap-3">
                {visibleBlocks.map((block, index) => {
                    switch (block.type) {
                        case "text": {
                            return <Response key={index}>{block.text}</Response>;
                        }
                        case "image": {
                            return (
                                <Image
                                    alt="Image from the agent"
                                    base64={block.data}
                                    className="max-w-sm"
                                    key={index}
                                    mediaType={block.mediaType}
                                />
                            );
                        }
                        case "thinking": {
                            return (
                                <Reasoning className="mb-0" defaultOpen={false} key={index}>
                                    <ReasoningTrigger />
                                    <ReasoningContent>
                                        {block.thinking !== ""
                                            ? block.thinking
                                            : "The model's reasoning was redacted."}
                                    </ReasoningContent>
                                </Reasoning>
                            );
                        }
                        case "tool_call": {
                            return (
                                <ToolCallView
                                    args={block.arguments}
                                    isSessionRunning={isSessionRunning}
                                    key={block.id}
                                    name={block.name}
                                    result={toolResults.get(block.id)}
                                />
                            );
                        }
                    }
                })}
            </MessageContent>
        </Message>
    );
}
