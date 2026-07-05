export function countTextLines(text: string): number {
    if (text.length === 0) {
        return 0;
    }

    return text.split(/\r?\n/u).filter((line) => line.length > 0).length;
}
