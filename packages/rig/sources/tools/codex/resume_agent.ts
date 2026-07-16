import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { requireSubagentContext } from "./requireSubagentContext.js";
import { managedSubagentSchema } from "./subagentSchemas.js";

export const codexResumeAgentTool = defineTool({
    name: "resume_agent",
    label: "resume_agent",
    description: "Resume a suspended subagent from its retained conversation and task context.",
    arguments: Type.Object({
        target: Type.String({ description: "Agent id, task name, or full task path." }),
    }),
    returnType: managedSubagentSchema,
    shouldReviewInAutoMode: () => false,
    execute: ({ target }, context) => requireSubagentContext(context).resume(target),
    toLLM: (result) => [{ type: "text", text: JSON.stringify(result) }],
    toUI: (result) => `Resumed ${result.description}.`,
    locks: [],
});
