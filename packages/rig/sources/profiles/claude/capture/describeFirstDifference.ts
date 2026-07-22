export function describeFirstDifference(left: string, right: string): string {
    const limit = Math.min(left.length, right.length);
    let index = 0;
    while (index < limit && left[index] === right[index]) index += 1;
    const start = Math.max(0, index - 120);
    const end = index + 240;
    return `first difference at byte ${index}:\nrequest=${JSON.stringify(left.slice(start, end))}\nprobe=${JSON.stringify(right.slice(start, end))}`;
}
