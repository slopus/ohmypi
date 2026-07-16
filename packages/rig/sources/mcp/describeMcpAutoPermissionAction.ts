import { quoteVisibleExact } from "../permissions/quoteVisibleExact.js";
import { humanizeMcpName } from "./humanizeMcpName.js";

export function describeMcpAutoPermissionAction(options: {
    arguments: unknown;
    server: string;
    tool: string;
}): string {
    let serializedArguments: string;
    try {
        serializedArguments = JSON.stringify(options.arguments ?? {}) ?? String(options.arguments);
    } catch {
        serializedArguments = String(options.arguments);
    }
    return `calling ${quoteVisibleExact(humanizeMcpName(options.tool))} from ${quoteVisibleExact(humanizeMcpName(options.server))} with arguments ${quoteVisibleExact(serializedArguments)}. Access: the MCP server can perform actions outside Rig’s filesystem sandbox`;
}
