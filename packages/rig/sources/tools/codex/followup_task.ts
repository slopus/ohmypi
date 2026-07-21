import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { managedSubagentSchema } from "./subagentSchemas.js";
import { requireSubagentContext } from "./requireSubagentContext.js";

export const codexFollowupTaskTool = defineTool({
    name: "followup_task",
    label: "followup_task",
    description:
        "Send follow-up work to an existing subagent, including one that completed or was stopped earlier. Its saved session and full context are reused. If it is idle, this starts another turn; if it is busy, the work is queued.",
    arguments: Type.Object({
        target: Type.String({ description: "Agent id, task name, or full task path." }),
        message: Type.String({ description: "The follow-up instructions." }),
        effort: Type.Optional(
            Type.String({
                description:
                    "New effort level for the subagent. Must be one of its model's allowed effort levels shown in the system prompt.",
            }),
        ),
    }),
    returnType: managedSubagentSchema,
    shouldReviewInAutoMode: () => false,
    execute: ({ effort, message, target }, context) =>
        requireSubagentContext(context).followUp(target, message, effort),
    toLLM: (result) => [{ type: "text", text: JSON.stringify(result) }],
    toUI: (result) => `Sent follow-up work to ${result.description}.`,
    locks: [],
});
