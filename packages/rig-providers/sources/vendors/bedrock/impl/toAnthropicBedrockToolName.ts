export function toAnthropicBedrockToolName(tool: {
    readonly name: string;
    readonly namespace?: string;
}): string {
    return tool.namespace === undefined ? tool.name : `mcp__${tool.namespace}__${tool.name}`;
}
