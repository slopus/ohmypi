const CLAUDE_CODE_PRODUCT_LINES = [
    " - Claude Code is available as a CLI in the terminal, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).\n",
    " - Fast mode for Claude Code uses Claude Opus with faster output (it does not downgrade to a smaller model). It can be toggled with /fast and is available on Opus 4.8/4.7.\n",
] as const;

const SONNET_HELP_BULLET =
    " - If the user asks for help or wants to give feedback inform them of the following:\n  - /help: Get help with using Claude Code\n  - To give feedback, users should report the issue at https://github.com/anthropics/claude-code/issues";

export interface ClaudePromptTransformation {
    identity: string;
    memoryHeading: "# Memory" | "# auto memory";
}

export function computeClaudeProfilePrompt(
    goldenPrompt: string,
    transformation: ClaudePromptTransformation,
): string {
    let prompt = goldenPrompt;
    if (!prompt.startsWith("\n")) {
        throw new Error("Claude Code prompt body no longer starts with the captured newline.");
    }

    if (transformation.memoryHeading === "# auto memory") {
        prompt = removeSection(prompt, "# Session-specific guidance", "# auto memory");
        prompt = removeSection(prompt, "# auto memory", "# Environment");
        prompt = replaceExactlyOnce(prompt, SONNET_HELP_BULLET, "");
        prompt = replaceExactlyOnce(
            prompt,
            "durable instructions like CLAUDE.md files",
            "durable instructions like AGENTS.md files",
        );
    } else {
        prompt = removeSection(prompt, transformation.memoryHeading, "# Environment");
    }
    for (const line of CLAUDE_CODE_PRODUCT_LINES) {
        prompt = replaceExactlyOnce(prompt, line, "");
    }

    return `${transformation.identity}\n${prompt.slice(1)}`;
}

function removeSection(prompt: string, heading: string, nextHeading: string): string {
    const startMarker = `${heading}\n`;
    const endMarker = `\n${nextHeading}\n`;
    const start = prompt.indexOf(startMarker);
    const end = prompt.indexOf(endMarker, start);
    if (start === -1 || end === -1) {
        throw new Error(`Claude Code prompt section '${heading}' changed or disappeared.`);
    }
    if (prompt.indexOf(startMarker, start + startMarker.length) !== -1) {
        throw new Error(`Claude Code prompt section '${heading}' is no longer unique.`);
    }
    return `${prompt.slice(0, start)}${prompt.slice(end + 1)}`;
}

function replaceExactlyOnce(prompt: string, find: string, replace: string): string {
    const first = prompt.indexOf(find);
    if (first === -1 || prompt.indexOf(find, first + find.length) !== -1) {
        throw new Error(`Claude Code prompt transformation expected exactly one match: ${find}`);
    }
    return `${prompt.slice(0, first)}${replace}${prompt.slice(first + find.length)}`;
}
