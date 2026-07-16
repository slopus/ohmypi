export function lineRanges(content: string): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];
    let start = 0;
    for (let index = 0; index <= content.length; index++) {
        if (index === content.length || content[index] === "\n") {
            ranges.push({ start, end: index });
            start = index + 1;
        }
    }
    return ranges;
}
