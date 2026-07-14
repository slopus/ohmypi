export function parseGlobalEventCursor(value: string | null): number | undefined {
    if (value === null || !/^\d+$/u.test(value)) return undefined;
    const cursor = Number(value);
    return Number.isSafeInteger(cursor) ? cursor : undefined;
}
