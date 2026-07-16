import type { TerminalScrollSnapshot } from "./types.js";

interface ScrollbackTerminal {
    scrollBy(rows: number): void;
    scrollToBottom(): void;
    scrollToTop(): void;
    snapshot(): Promise<{
        rows: readonly string[];
        scroll: Pick<TerminalScrollSnapshot, "atBottom" | "offset" | "totalRows" | "visibleRows">;
    }>;
}

export async function captureScrollback(gym: { terminal: ScrollbackTerminal }): Promise<string> {
    gym.terminal.scrollToTop();
    try {
        let snapshot = await gym.terminal.snapshot();
        const rows = new Map<number, string>();

        for (;;) {
            snapshot.rows.forEach((row, index) => {
                rows.set(snapshot.scroll.offset + index, row);
            });
            if (snapshot.scroll.atBottom) break;
            const maximumOffset = snapshot.scroll.totalRows - snapshot.scroll.visibleRows;
            const nextOffset = Math.min(
                snapshot.scroll.offset + snapshot.scroll.visibleRows,
                maximumOffset,
            );
            gym.terminal.scrollBy(nextOffset - snapshot.scroll.offset);
            snapshot = await gym.terminal.snapshot();
        }

        return [...rows.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, row]) => row)
            .join("\n");
    } finally {
        gym.terminal.scrollToBottom();
    }
}
