import type { EditFileOptions, EditMatch } from "./editFileTypes.js";
import { findExactEditMatch } from "./findExactEditMatch.js";
import { findFuzzyEditMatch } from "./findFuzzyEditMatch.js";

export function findEditMatch(content: string, options: EditFileOptions): EditMatch | undefined {
    const exact = findExactEditMatch(content, options);
    if (exact !== undefined) return exact;
    return options.fuzzy ? findFuzzyEditMatch(content, options) : undefined;
}
