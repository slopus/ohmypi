export function quoteVisibleExact(value: string): string {
    let visible = "";
    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (character === "\\") visible += "\\\\";
        else if (character === '"') visible += '\\"';
        else if (character === "\n") visible += "\\n";
        else if (character === "\r") visible += "\\r";
        else if (character === "\t") visible += "\\t";
        else if (
            codePoint < 0x20 ||
            codePoint === 0x7f ||
            (codePoint >= 0x202a && codePoint <= 0x202e) ||
            (codePoint >= 0x2066 && codePoint <= 0x2069)
        ) {
            visible += `\\u{${codePoint.toString(16).padStart(4, "0")}}`;
        } else {
            visible += character;
        }
    }
    return `"${visible}"`;
}
