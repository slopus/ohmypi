import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

import { formatActivityElapsedTime } from "./formatActivityElapsedTime.js";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export function renderTurnCompletionSeparator(elapsedMs: number, width: number): string {
    const safeWidth = Math.max(1, width);
    if (elapsedMs <= 60_000) {
        return `${DIM}${"─".repeat(safeWidth)}${RESET}`;
    }
    const label = `─ Worked for ${formatActivityElapsedTime(elapsedMs)} ─`;
    const rule = "─".repeat(Math.max(0, safeWidth - visibleWidth(label)));
    return truncateToWidth(`${DIM}${label}${rule}${RESET}`, safeWidth, "", true);
}
