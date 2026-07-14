import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import type { ExecCommandPresentation } from "../agent/ToolResultPresentation.js";
import { highlightShellCommand } from "./highlightShellCommand.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const NOT_BOLD = "\x1b[22m";
const DIM = "\x1b[2m";
const MAX_OUTPUT_EDGE_LINES = 5;

export function renderExecCommand(
    presentation: ExecCommandPresentation,
    options: {
        brand: string;
        primary: string;
        status: string;
        verb: string;
        width: number;
    },
): string[] {
    const width = Math.max(1, options.width);
    const headerPrefix = `${options.status}•${RESET} ${options.brand}${BOLD}${options.verb}${NOT_BOLD}${RESET} `;
    const continuationPrefix = `${DIM}  │ ${RESET}`;
    const command = sanitizeTerminalText(presentation.command).replaceAll("\t", "    ");
    const highlighted = highlightShellCommand(command.length === 0 ? "command" : command);
    const commandWidth = Math.max(1, width - visibleWidth(headerPrefix));
    const wrappedCommand = wrapTextWithAnsi(highlighted, commandWidth);
    const lines = wrappedCommand.map((line, index) =>
        truncateToWidth(
            `${index === 0 ? headerPrefix : continuationPrefix}${line}${options.primary}`,
            width,
            "",
            true,
        ),
    );

    const outputLines = selectOutputLines(presentation.output);
    for (const [index, output] of outputLines.entries()) {
        const final = index === outputLines.length - 1;
        const prefix = `${DIM}  ${final ? "└" : "│"} ${RESET}${DIM}`;
        lines.push(truncateToWidth(`${prefix}${output}${RESET}`, width, "", true));
    }
    return lines;
}

function selectOutputLines(output: string): string[] {
    const sanitized = sanitizeTerminalText(output).replaceAll("\t", "    ");
    const lines = sanitized.replace(/\n+$/u, "").split("\n");
    if (lines.length === 1 && lines[0]?.length === 0) return ["(no output)"];
    if (lines.length <= MAX_OUTPUT_EDGE_LINES * 2) return lines;
    const omitted = lines.length - MAX_OUTPUT_EDGE_LINES * 2;
    return [
        ...lines.slice(0, MAX_OUTPUT_EDGE_LINES),
        `… +${omitted} lines`,
        ...lines.slice(-MAX_OUTPUT_EDGE_LINES),
    ];
}
