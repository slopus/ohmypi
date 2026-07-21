import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import type { ExecCommandPresentation } from "../agent/ToolResultPresentation.js";
import { highlightShellCommand } from "./highlightShellCommand.js";
import { renderChildRows, type ChildRow } from "./renderChildRows.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const NOT_BOLD = "\x1b[22m";
const DIM = "\x1b[2m";
const MAX_OUTPUT_EDGE_LINES = 5;

export function renderExecCommand(
    presentation: ExecCommandPresentation,
    options: {
        active?: boolean;
        brand: string;
        detail?: string;
        primary: string;
        review?: string;
        status: string;
        verb: string;
        width: number;
    },
): string[] {
    const width = Math.max(1, options.width);
    const headerPrefix = `${options.status}•${RESET} ${options.brand}${BOLD}${options.verb}${NOT_BOLD}${RESET} `;
    const continuationPrefix = " ".repeat(visibleWidth(headerPrefix));
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

    const childRows: ChildRow[] = [];
    if (options.review !== undefined) {
        childRows.push({ prefix: DIM, suffix: RESET, text: options.review });
    }
    if (options.detail !== undefined) {
        childRows.push({ prefix: DIM, suffix: RESET, text: options.detail });
    }
    if (options.active !== true) {
        const outputLines = selectOutputLines(presentation.output);
        childRows.push(
            ...outputLines.map((output) => ({
                prefix: DIM,
                suffix: RESET,
                text: output,
                wrap: true,
            })),
        );
    }
    lines.push(
        ...renderChildRows(childRows, { afterMarker: `${RESET}${DIM}`, markerStyle: DIM, width }),
    );
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
