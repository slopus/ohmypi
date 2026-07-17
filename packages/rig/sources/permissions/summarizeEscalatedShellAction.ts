import { quoteVisibleExact } from "./quoteVisibleExact.js";

export function summarizeEscalatedShellAction(options: {
    command: string;
    cwd: string;
    shell?: string;
}): string {
    const shell =
        options.shell === undefined ? "the system login shell" : `${options.shell} (login)`;
    return `running ${quoteVisibleExact(options.command)}. Working directory: ${quoteVisibleExact(options.cwd)}. Shell: ${quoteVisibleExact(shell)}. Access: unrestricted filesystem and network access`;
}
