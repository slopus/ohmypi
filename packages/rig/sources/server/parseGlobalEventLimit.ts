export function parseGlobalEventLimit(value: string | null): number | undefined {
    if (value === null || !/^\d+$/u.test(value)) return undefined;
    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit <= 0) return undefined;
    return Math.min(limit, 1_000);
}
