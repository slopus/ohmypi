import { quoteVisibleExact } from "./summarizePermissionAction.js";

export function summarizeEscalatedShellAction(options: {
    command: string;
    cwd: string;
    shell?: string;
}): string {
    return `running ${quoteVisibleExact(options.command)}. Working directory: ${quoteVisibleExact(options.cwd)}. Shell: ${quoteVisibleExact(options.shell ?? "the default shell")}. Access: unrestricted filesystem and network access`;
}
