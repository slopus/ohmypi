/** Structural equality for JSON-shaped Codex request values, independent of object key order. */
export function codexValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
            return false;
        return left.every((value, index) => codexValuesEqual(value, right[index]));
    }
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!codexValuesEqual(leftKeys, rightKeys)) return false;
    return leftKeys.every((key) => codexValuesEqual(left[key], right[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
