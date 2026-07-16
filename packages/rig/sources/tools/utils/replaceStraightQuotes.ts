export function replaceStraightQuotes(
    value: string,
    quote: string,
    pair: readonly [string, string],
): string {
    let opening = true;
    let output = "";
    for (const character of value) {
        if (character === quote) {
            output += opening ? pair[0] : pair[1];
            opening = !opening;
        } else {
            output += character;
        }
    }
    return output;
}
