import type { EditFileOptions, TextEditPlan } from "./editFileTypes.js";
import { findAllOccurrences } from "./findAllOccurrences.js";
import { findEditMatch } from "./findEditMatch.js";
import { preserveQuoteStyle } from "./preserveQuoteStyle.js";

export function planTextEditInContent(
    content: string,
    filePath: string,
    options: EditFileOptions,
): TextEditPlan {
    if (options.oldString === options.newString) {
        throw new Error("No changes to make: old_string and new_string are identical");
    }
    if (options.oldString.length === 0) {
        throw new Error("old_string must not be empty");
    }

    const allExactPositions = findAllOccurrences(content, options.oldString);
    if (options.replaceAll && allExactPositions.length > 0) {
        return {
            path: filePath,
            nextContent: content.split(options.oldString).join(options.newString),
            replacements: allExactPositions.length,
            fuzzy: false,
        };
    }

    const match = findEditMatch(content, options);
    if (match === undefined) {
        throw new Error(`old_string was not found in ${options.path}`);
    }
    const actualOldString = content.slice(match.start, match.end);
    const nextString = preserveQuoteStyle(options.oldString, actualOldString, options.newString);

    return {
        path: filePath,
        nextContent: content.slice(0, match.start) + nextString + content.slice(match.end),
        replacements: match.replacements,
        fuzzy: match.fuzzy,
    };
}
