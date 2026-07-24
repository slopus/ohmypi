import { Type } from "@sinclair/typebox";
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import type { SessionTool } from "@/core/SessionTool.js";
import { toAnthropicBedrockToolName } from "@/vendors/bedrock/impl/toAnthropicBedrockToolName.js";

export function toAnthropicBedrockTools(tools: readonly SessionTool[]): BetaTool[] {
    return tools.map((tool) => {
        if (tool.type !== "local") {
            throw new Error(`Anthropic Bedrock tools must execute locally: '${tool.name}'.`);
        }
        const schema = tool.parameters ?? Type.Object({}, { additionalProperties: false });
        if (schema.type !== "object") {
            throw new Error(`Anthropic Bedrock tool '${tool.name}' must use an object schema.`);
        }
        return {
            name: toAnthropicBedrockToolName(tool),
            description: tool.description ?? "",
            input_schema: { ...schema, type: "object" },
        };
    });
}
