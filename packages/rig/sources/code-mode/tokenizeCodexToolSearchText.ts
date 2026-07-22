import { createRequire } from "node:module";
import { deunicode } from "deunicode";

import { englishCodexToolSearchStopWords } from "./englishCodexToolSearchStopWords.js";

const stem = createRequire(import.meta.url)("wink-porter2-stemmer") as (word: string) => string;
const segmenter = new Intl.Segmenter("en", { granularity: "word" });

export function tokenizeCodexToolSearchText(text: string): string[] {
    const normalized = deunicode(text)
        .normalize("NFKD")
        .replace(/\p{Mark}/gu, "")
        .toLowerCase();
    return Array.from(segmenter.segment(normalized))
        .filter((segment) => segment.isWordLike)
        .map((segment) => segment.segment)
        .filter((token) => !englishCodexToolSearchStopWords.has(token))
        .map(stem);
}
