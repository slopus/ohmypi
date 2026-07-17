import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { KIMI_TODO_LIST_DESCRIPTION } from "./kimiToolDescriptions.js";

const kimiTodoMetadata = { source: "kimi_todo_list" } as const;

const todoSchema = Type.Object(
    {
        title: Type.String({ minLength: 1, description: "Short, actionable title." }),
        status: Type.Union(
            [Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("done")],
            { description: "Current status of the TODO item." },
        ),
    },
    { additionalProperties: false },
);

const todoListSchema = Type.Array(todoSchema);

export const kimiTodoListTool = defineTool({
    name: "TodoList",
    label: "TodoList",
    description: KIMI_TODO_LIST_DESCRIPTION,
    arguments: Type.Object(
        {
            todos: Type.Optional(
                Type.Array(todoSchema, {
                    description:
                        "Replacement TODO list. Omit to query; pass an empty array to clear.",
                }),
            ),
        },
        { additionalProperties: false },
    ),
    returnType: Type.Object({ todos: todoListSchema }),
    shouldReviewInAutoMode: () => false,
    execute({ todos }, context) {
        if (context.tasks === undefined) {
            throw new Error("Task tracking is unavailable in this session.");
        }
        const current = context.tasks
            .list()
            .filter((task) => task.metadata?.source === kimiTodoMetadata.source);
        if (todos === undefined) {
            return {
                todos: current.map((task) => ({
                    title: task.subject,
                    status: task.status === "completed" ? ("done" as const) : task.status,
                })),
            };
        }

        for (const task of current) {
            const result = context.tasks.update(task.id, { status: "deleted" });
            if (!result.success) {
                throw new Error(result.error ?? `Could not remove TODO ${task.id}.`);
            }
        }
        for (const todo of todos) {
            const task = context.tasks.create({
                description: todo.title,
                metadata: kimiTodoMetadata,
                subject: todo.title,
            });
            if (todo.status !== "pending") {
                const result = context.tasks.update(task.id, {
                    status: todo.status === "done" ? "completed" : "in_progress",
                });
                if (!result.success) {
                    throw new Error(result.error ?? `Could not update TODO ${task.id}.`);
                }
            }
        }
        return { todos };
    },
    toLLM: ({ todos }) => [{ type: "text", text: JSON.stringify({ todos }) }],
    toUI: ({ todos }) =>
        todos.length === 0
            ? "Kimi TODO list is empty"
            : `Kimi TODO list: ${todos.length} item${todos.length === 1 ? "" : "s"}`,
    locks: ["tasks"],
});
