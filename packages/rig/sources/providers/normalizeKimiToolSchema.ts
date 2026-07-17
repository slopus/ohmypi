export function normalizeKimiToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const root = structuredClone(schema);
    const normalized = resolveRefs(root, root, new Set());
    normalizeChildren(normalized, false);
    if (!containsDefinitionRef(normalized, "$defs")) delete normalized.$defs;
    if (!containsDefinitionRef(normalized, "definitions")) delete normalized.definitions;
    return normalized;
}

function resolveRefs(
    node: unknown,
    root: Record<string, unknown>,
    visiting: Set<string>,
): Record<string, unknown> {
    if (!isRecord(node)) return {};
    const ref = node.$ref;
    if (typeof ref === "string" && ref.startsWith("#/") && !visiting.has(ref)) {
        const target = resolvePointer(root, ref);
        if (isRecord(target)) {
            visiting.add(ref);
            const resolved = resolveRefs(target, root, visiting);
            visiting.delete(ref);
            return Object.fromEntries([
                ...Object.entries(resolved),
                ...Object.entries(node)
                    .filter(([key]) => key !== "$ref")
                    .map(([key, value]) => [key, resolveValue(value, root, visiting)]),
            ]);
        }
    }
    return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, resolveValue(value, root, visiting)]),
    );
}

function resolveValue(
    value: unknown,
    root: Record<string, unknown>,
    visiting: Set<string>,
): unknown {
    if (Array.isArray(value)) return value.map((item) => resolveValue(item, root, visiting));
    return isRecord(value) ? resolveRefs(value, root, visiting) : value;
}

function resolvePointer(root: Record<string, unknown>, ref: string): unknown {
    let current: unknown = root;
    for (const rawPart of ref.slice(2).split("/")) {
        const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
        if (!isRecord(current) || !(part in current)) return undefined;
        current = current[part];
    }
    return current;
}

function normalizeChildren(node: unknown, nestedProperty: boolean): void {
    if (!isRecord(node)) return;
    // Moonshot requires a type on every property, but rejects a parent type
    // alongside anyOf/oneOf/allOf; the type must live on each composed item.
    if (node.type === undefined && nestedProperty && !usesComposition(node)) {
        node.type = inferType(node);
    }
    if (node.type !== undefined && usesComposition(node)) delete node.type;
    const propertyMaps = [node.properties, node.patternProperties, node.$defs, node.definitions];
    for (const map of propertyMaps) {
        if (!isRecord(map)) continue;
        for (const child of Object.values(map)) normalizeChildren(child, true);
    }
    for (const key of [
        "additionalItems",
        "additionalProperties",
        "contains",
        "else",
        "if",
        "items",
        "not",
        "propertyNames",
        "then",
    ]) {
        normalizeChildren(node[key], true);
    }
    for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
        const children = node[key];
        if (Array.isArray(children)) {
            for (const child of children) normalizeChildren(child, true);
        }
    }
}

function usesComposition(node: Record<string, unknown>): boolean {
    return Array.isArray(node.anyOf) || Array.isArray(node.oneOf) || Array.isArray(node.allOf);
}

function inferType(node: Record<string, unknown>): string {
    if (node.properties !== undefined || node.required !== undefined) return "object";
    if (node.items !== undefined || node.prefixItems !== undefined) return "array";
    if (node.minimum !== undefined || node.maximum !== undefined || node.multipleOf !== undefined) {
        return "number";
    }
    const candidates = Array.isArray(node.enum) ? node.enum : "const" in node ? [node.const] : [];
    const types = new Set(candidates.map(jsonType).filter((type) => type !== undefined));
    return types.size === 1 ? ([...types][0] ?? "string") : "string";
}

function jsonType(value: unknown): string | undefined {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
    if (typeof value === "object") return "object";
    if (typeof value === "string" || typeof value === "boolean") return typeof value;
    return undefined;
}

function containsDefinitionRef(node: unknown, bucket: string): boolean {
    if (Array.isArray(node)) return node.some((child) => containsDefinitionRef(child, bucket));
    if (!isRecord(node)) return false;
    if (typeof node.$ref === "string" && node.$ref.startsWith(`#/${bucket}/`)) return true;
    return Object.entries(node).some(
        ([key, value]) => key !== bucket && containsDefinitionRef(value, bucket),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && !Array.isArray(value) && typeof value === "object";
}
