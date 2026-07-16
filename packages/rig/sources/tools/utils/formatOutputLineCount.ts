import { countTextLines } from "./countTextLines.js";

export function formatOutputLineCount(text: string): string {
    const count = countTextLines(text);
    return `${String(count)} output ${count === 1 ? "line" : "lines"}`;
}
