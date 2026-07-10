import { Type } from "@sinclair/typebox";

import { defineTool } from "../agent/types.js";

const agentResultSchema = Type.Object({
    output: Type.String(),
    sessionId: Type.String(),
    status: Type.Union([Type.Literal("aborted"), Type.Literal("completed"), Type.Literal("error")]),
});

export const agentTool = defineTool({
    name: "Agent",
    label: "Agent",
    description:
        "Start a synchronous subagent for a focused, self-contained task. The subagent has its own conversation history and returns its final response. It stops when this tool call is aborted.",
    arguments: Type.Object({
        description: Type.String({
            description: "A short, human-readable description of the delegated task.",
        }),
        prompt: Type.String({
            description: "Complete instructions for the subagent.",
        }),
    }),
    returnType: agentResultSchema,
    execute: async ({ description, prompt }, context, execution) => {
        if (context.subagents === undefined || !context.subagents.canSpawn) {
            throw new Error("This agent has reached the maximum subagent depth.");
        }

        const result = await context.subagents.spawn(
            {
                description,
                prompt,
                ...(execution.toolCallId !== undefined
                    ? { parentToolCallId: execution.toolCallId }
                    : {}),
            },
            execution.signal,
        );
        if (result.status !== "completed") {
            throw new Error(result.output);
        }
        return result;
    },
    toLLM: (result) => [
        {
            type: "text",
            text:
                result.status === "completed"
                    ? result.output
                    : `The subagent ${result.status}. ${result.output}`,
        },
    ],
    toUI: (result, args) =>
        result.status === "completed"
            ? `Completed: ${args.description}`
            : `${result.status === "aborted" ? "Stopped" : "Failed"}: ${args.description}`,
    locks: [],
});
