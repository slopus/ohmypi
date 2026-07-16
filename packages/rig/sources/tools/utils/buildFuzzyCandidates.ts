import type { EditMatch } from "./editFileTypes.js";
import { candidateWindows } from "./candidateWindows.js";
import { normalizeForEditMatch } from "./normalizeForEditMatch.js";

export function buildFuzzyCandidates(content: string, oldString: string): EditMatch[] {
    const normalizedNeedle = normalizeForEditMatch(oldString);
    if (normalizedNeedle.length === 0) return [];

    const candidates: EditMatch[] = [];
    for (const candidate of candidateWindows(content, oldString)) {
        if (normalizeForEditMatch(candidate.text) === normalizedNeedle) {
            candidates.push({
                start: candidate.start,
                end: candidate.end,
                replacements: 1,
                fuzzy: true,
            });
        }
    }
    return candidates;
}
