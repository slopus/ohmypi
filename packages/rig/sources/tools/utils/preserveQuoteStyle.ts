import { replaceStraightQuotes } from "./replaceStraightQuotes.js";

export function preserveQuoteStyle(
    oldString: string,
    actualOldString: string,
    newString: string,
): string {
    if (oldString === actualOldString) return newString;

    let result = newString;
    if (actualOldString.includes("\u201C") || actualOldString.includes("\u201D")) {
        result = replaceStraightQuotes(result, '"', ["\u201C", "\u201D"]);
    }
    if (actualOldString.includes("\u2018") || actualOldString.includes("\u2019")) {
        result = replaceStraightQuotes(result, "'", ["\u2018", "\u2019"]);
    }
    return result;
}
