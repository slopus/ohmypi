import { createInterface } from "node:readline/promises";

import type { SessionSummary } from "../protocol/index.js";
import { sanitizeTerminalText } from "./sanitizeTerminalText.js";

const MAX_RECAP_DISPLAY_CHARS = 160;

export async function selectSession(
    sessions: readonly SessionSummary[],
    streams: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } = {},
): Promise<string> {
    if (sessions.length === 0) {
        throw new Error("No saved sessions were found.");
    }
    const input = streams.input ?? process.stdin;
    if ((input as NodeJS.ReadableStream & { isTTY?: boolean }).isTTY !== true) {
        throw new Error("Choose a session ID or use --last when input is not interactive.");
    }

    const output = streams.output ?? process.stdout;
    output.write("Saved sessions:\n\n");
    sessions.slice(0, 20).forEach((session, index) => {
        const title = session.title ?? "Untitled session";
        const date = new Date(session.lastMessageAt ?? session.updatedAt).toLocaleString();
        output.write(`${index + 1}. ${title}\n   ${session.cwd} · ${date}\n`);
        const recap = oneLineRecap(session.recap);
        if (recap !== undefined) output.write(`   ${recap}\n`);
    });
    const readline = createInterface({
        input,
        output,
    });
    try {
        const answer = await readline.question(
            `\nChoose a session [1-${Math.min(20, sessions.length)}]: `,
        );
        const selection = Number(answer.trim());
        const maxSelection = Math.min(20, sessions.length);
        const selected = sessions[selection - 1];
        if (
            !Number.isInteger(selection) ||
            selection < 1 ||
            selection > maxSelection ||
            selected === undefined
        ) {
            throw new Error("The selected session number is not valid.");
        }
        return selected.id;
    } finally {
        readline.close();
    }
}

function oneLineRecap(recap: string | undefined): string | undefined {
    if (recap === undefined) return undefined;
    const line = sanitizeTerminalText(recap).replace(/\s+/gu, " ").trim();
    if (line.length === 0) return undefined;
    return line.length <= MAX_RECAP_DISPLAY_CHARS
        ? line
        : `${line.slice(0, MAX_RECAP_DISPLAY_CHARS - 1)}…`;
}
