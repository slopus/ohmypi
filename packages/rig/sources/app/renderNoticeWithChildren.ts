import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import type { NoticeChild } from "./NoticeChild.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const BOLD = "\x1b[1m";
const NOT_BOLD_OR_DIM = "\x1b[22m";
const RESET = "\x1b[0m";
const CHILD_INDENT = "  ";

export function renderNoticeWithChildren(options: {
    readonly children: readonly NoticeChild[];
    readonly color: string;
    readonly title: string;
    readonly width: number;
}): string[] {
    const width = Math.max(1, Math.floor(options.width));
    const safeTitle = sanitizeTerminalText(options.title).replace(/\s+/gu, " ").trim();
    const lines = [
        truncateToWidth(
            `${options.color}•${RESET} ${BOLD}${safeTitle}${NOT_BOLD_OR_DIM}`,
            width,
            "",
            true,
        ),
    ];
    const indent = width > visibleWidth(CHILD_INDENT) ? CHILD_INDENT : "";
    const childWidth = Math.max(1, width - visibleWidth(indent));

    for (const child of options.children) {
        const label = sanitizeTerminalText(child.label).replace(/\s+/gu, " ").trim();
        const reason = sanitizeTerminalText(child.reason).replace(/\s+/gu, " ").trim();
        const childText = `${label} — ${reason}`;
        for (const row of wrapTextWithAnsi(childText, childWidth)) {
            lines.push(truncateToWidth(`${indent}${row}`, width, "", true));
        }
    }

    return lines;
}
