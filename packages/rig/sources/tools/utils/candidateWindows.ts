import { splitLines } from "./path.js";
import { lineRanges } from "./lineRanges.js";

export function* candidateWindows(
    content: string,
    oldString: string,
): Iterable<{ start: number; end: number; text: string }> {
    const lineCount = splitLines(oldString).length;
    const ranges = lineRanges(content);
    for (let index = 0; index < ranges.length; index++) {
        for (let size = Math.max(1, lineCount - 1); size <= lineCount + 1; size++) {
            const endLine = index + size - 1;
            const endRange = ranges[endLine];
            const startRange = ranges[index];
            if (!startRange || !endRange) continue;

            yield {
                start: startRange.start,
                end: endRange.end,
                text: content.slice(startRange.start, endRange.end),
            };
        }
    }
}
