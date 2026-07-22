export const MAX_JSON_DEPTH = 100;

export function assertJsonValue(
    value: unknown,
    path = "$",
    ancestors: Set<object> = new Set(),
    depth = 0,
): asserts value is import("./types.js").JsonValue {
    if (depth > MAX_JSON_DEPTH) {
        throw new Error(
            `Code Mode protocol value at ${path} exceeds the maximum JSON depth of ${String(MAX_JSON_DEPTH)}.`,
        );
    }
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`Code Mode protocol value at ${path} contains a non-finite number.`);
        }
        return;
    }
    if (typeof value !== "object") {
        throw new Error(`Code Mode protocol value at ${path} is not JSON-serializable.`);
    }
    if (ancestors.has(value)) {
        throw new Error(`Code Mode protocol value at ${path} contains a cycle.`);
    }
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            value.forEach((item, index) =>
                assertJsonValue(item, `${path}[${String(index)}]`, ancestors, depth + 1),
            );
            return;
        }
        const prototype = Object.getPrototypeOf(value) as unknown;
        if (prototype !== Object.prototype && prototype !== null) {
            throw new Error(`Code Mode protocol value at ${path} is not a plain JSON object.`);
        }
        for (const [key, item] of Object.entries(value)) {
            assertJsonValue(item, `${path}.${key}`, ancestors, depth + 1);
        }
    } finally {
        ancestors.delete(value);
    }
}
