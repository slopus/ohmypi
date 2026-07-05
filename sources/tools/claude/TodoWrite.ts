import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { textOutputSchema, toTextBlocks } from "../utils/index.js";

const todoSchema = Type.Object({
    content: Type.String(),
    activeForm: Type.String(),
    status: Type.Union([
        Type.Literal("pending"),
        Type.Literal("in_progress"),
        Type.Literal("completed"),
    ]),
});

export const claudeTodoWriteTool = defineTool({
    name: "TodoWrite",
    label: "TodoWrite",
    description:
        "Update the todo list for the current session. To be used proactively and often to track progress and pending tasks. Make sure that at least one task is in_progress at all times. Always provide both content (imperative) and activeForm (present continuous) for each task.",
    arguments: Type.Object({
        todos: Type.Array(todoSchema, { description: "The updated todo list" }),
    }),
    returnType: textOutputSchema,
    execute: async ({ todos }) => ({
        text: `Todos have been modified successfully. ${todos.length} item(s) provided.`,
    }),
    toLLM: toTextBlocks,
    toUI: (_result, args) =>
        `Updated ${args.todos.length} todo${args.todos.length === 1 ? "" : "s"}`,
    locks: ["TodoWrite"],
});
