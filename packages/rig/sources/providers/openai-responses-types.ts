export interface ActiveOpenAIResponsesOutputItem {
    argumentsJson?: string;
    contentIndex: number;
    type: "message" | "reasoning" | "toolCall";
}
