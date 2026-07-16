export function normalizeForEditMatch(value: string): string {
    return value
        .replaceAll("\u2018", "'")
        .replaceAll("\u2019", "'")
        .replaceAll("\u201A", "'")
        .replaceAll("\u201B", "'")
        .replaceAll("\u201C", '"')
        .replaceAll("\u201D", '"')
        .replaceAll("\u201E", '"')
        .replaceAll("\u201F", '"')
        .normalize("NFKC")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
        .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();
}
