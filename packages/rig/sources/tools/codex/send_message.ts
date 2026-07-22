import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { managedSubagentSchema } from "./subagentSchemas.js";
import { requireSubagentContext } from "./requireSubagentContext.js";

export const codexSendMessageTool = defineTool({
    name: "send_message",
    label: "send_message",
    description: "Send a message to an existing subagent without starting another turn.",
    arguments: Type.Object(
        {
            target: Type.String(),
            message: Type.String(),
        },
        { additionalProperties: false },
    ),
    returnType: managedSubagentSchema,
    shouldReviewInAutoMode: () => false,
    execute: (args, context) => {
        const { encrypted_message, message, target } = args as typeof args & {
            encrypted_message?: string;
        };
        const sendMessage = requireSubagentContext(context).sendMessage;
        if (sendMessage === undefined) throw new Error("Subagent messaging is unavailable.");
        return sendMessage(target, message, encrypted_message);
    },
    toLLM: (result) => [{ type: "text", text: JSON.stringify(result) }],
    toUI: (result) => `Sent a message to ${result.description}.`,
    locks: [],
});
