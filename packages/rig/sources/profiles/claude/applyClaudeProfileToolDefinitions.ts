import type { AnyDefinedTool } from "../../agent/types.js";
import type { ClaudeToolDefinition } from "./types.js";
import { hydrateClaudeToolSchema } from "./hydrateClaudeToolSchema.js";

export function applyClaudeProfileToolDefinitions(
    tools: readonly AnyDefinedTool[],
    definitions: readonly ClaudeToolDefinition[],
): readonly AnyDefinedTool[] {
    const definitionByName = new Map(
        definitions.map((definition) => [definition.name, definition]),
    );
    return tools.map((tool) => {
        const definition = definitionByName.get(tool.name);
        if (definition === undefined) {
            throw new Error(`Claude profile artifact has no definition for '${tool.name}'.`);
        }
        return {
            ...tool,
            description: definition.description,
            arguments: hydrateClaudeToolSchema(definition.input_schema),
        } as AnyDefinedTool;
    });
}
