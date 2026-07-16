import type { EditFileOptions, EditMatch } from "./editFileTypes.js";
import { findAllOccurrences } from "./findAllOccurrences.js";

export function findExactEditMatch(
    content: string,
    options: EditFileOptions,
): EditMatch | undefined {
    const positions = findAllOccurrences(content, options.oldString);
    if (positions.length === 0) return undefined;

    if (options.replaceAll) {
        return {
            start: positions[0] ?? 0,
            end: (positions[0] ?? 0) + options.oldString.length,
            replacements: positions.length,
            fuzzy: false,
        };
    }

    if (positions.length > 1) {
        throw new Error(
            `The text to replace appears ${positions.length} times; include more surrounding context to make it unique.`,
        );
    }
    const selected = positions[0];
    if (selected === undefined) return undefined;

    return {
        start: selected,
        end: selected + options.oldString.length,
        replacements: 1,
        fuzzy: false,
    };
}
