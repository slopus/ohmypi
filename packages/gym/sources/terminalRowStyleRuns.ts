import type { TerminalColorSnapshot, TerminalSnapshot } from "./types.js";

export interface TerminalRowStyleRun {
    background: TerminalColorSnapshot | null;
    bold: boolean;
    dim: boolean;
    foreground: TerminalColorSnapshot | null;
    italic: boolean;
    text: string;
    x: number;
}

export function terminalRowStyleRuns(
    snapshot: Pick<TerminalSnapshot, "cells">,
    row: number,
): readonly TerminalRowStyleRun[] {
    const runs: TerminalRowStyleRun[] = [];
    let previousEnd = 0;
    let previousStyle = "";

    for (const cell of snapshot.cells.filter((candidate) => candidate.y === row)) {
        const style = JSON.stringify({
            background: cell.background,
            bold: cell.bold,
            dim: cell.dim,
            foreground: cell.foreground,
            italic: cell.italic,
        });
        const previous = runs.at(-1);
        if (previous === undefined || style !== previousStyle) {
            runs.push({
                background: cell.background,
                bold: cell.bold,
                dim: cell.dim,
                foreground: cell.foreground,
                italic: cell.italic,
                text: cell.text,
                x: cell.x,
            });
        } else {
            previous.text += " ".repeat(Math.max(0, cell.x - previousEnd)) + cell.text;
        }
        previousEnd = cell.x + 1;
        previousStyle = style;
    }

    return runs
        .map((run) => ({
            ...run,
            text: run.text.trim(),
            x: run.x + run.text.length - run.text.trimStart().length,
        }))
        .filter((run) => run.text.length > 0);
}
