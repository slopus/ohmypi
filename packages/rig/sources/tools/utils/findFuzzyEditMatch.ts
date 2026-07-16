import type { EditFileOptions, EditMatch } from "./editFileTypes.js";
import { buildFuzzyCandidates } from "./buildFuzzyCandidates.js";

export function findFuzzyEditMatch(
    content: string,
    options: EditFileOptions,
): EditMatch | undefined {
    const candidates = buildFuzzyCandidates(content, options.oldString);
    if (candidates.length === 0) return undefined;

    if (candidates.length > 1) {
        throw new Error(
            `The text to replace has ${candidates.length} fuzzy matches; include more surrounding context to make it unique.`,
        );
    }
    return candidates[0];
}
