import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import type { BackgroundTerminalInteractionPresentation } from "../agent/ToolResultPresentation.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function renderBackgroundTerminalInteraction(
    interaction: BackgroundTerminalInteractionPresentation,
    width: number,
): string[] {
    if (interaction.input.length === 0) return [];

    const prefix = `${DIM}↳${RESET} `;
    const label = "Interacted with background terminal";
    const command = sanitizeTerminalText(interaction.command).replaceAll("\n", " ");
    const header = `${prefix}${BOLD}${label}${RESET}${command.length === 0 ? "" : `${DIM} · ${command}${RESET}`}`;
    const lines = [truncateToWidth(header, Math.max(1, width), "", true)];

    const input = sanitizeTerminalText(interaction.input).replaceAll("\r", "");
    if (input.length === 0) return lines;
    const inputPrefix = `${DIM}  └ ${RESET}`;
    const inputWidth = Math.max(1, width - visibleWidth(inputPrefix));
    const wrapped = wrapTextWithAnsi(input, inputWidth);
    const indent = " ".repeat(visibleWidth(inputPrefix));
    lines.push(
        ...wrapped.map((line, index) =>
            truncateToWidth(`${index === 0 ? inputPrefix : indent}${line}`, width, "", true),
        ),
    );
    return lines;
}
