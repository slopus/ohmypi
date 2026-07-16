export function findAllOccurrences(haystack: string, needle: string): number[] {
    if (needle.length === 0) return [];
    const positions: number[] = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        positions.push(index);
        index = haystack.indexOf(needle, index + Math.max(1, needle.length));
    }
    return positions;
}
