import { Kind, type TSchema } from "@sinclair/typebox";

export function hydrateClaudeToolSchema(schema: TSchema): TSchema {
    const candidate = schema as TSchema & {
        additionalProperties?: boolean | TSchema;
        anyOf?: TSchema[];
        enum?: unknown[];
        items?: TSchema;
        properties?: Record<string, TSchema>;
        propertyNames?: TSchema;
        type?: string;
    };
    if (candidate.properties !== undefined) {
        for (const property of Object.values(candidate.properties)) {
            hydrateClaudeToolSchema(property);
        }
    }
    if (candidate.items !== undefined) hydrateClaudeToolSchema(candidate.items);
    if (
        candidate.additionalProperties !== undefined &&
        typeof candidate.additionalProperties !== "boolean"
    ) {
        hydrateClaudeToolSchema(candidate.additionalProperties);
    }
    if (candidate.propertyNames !== undefined) hydrateClaudeToolSchema(candidate.propertyNames);
    if (candidate.anyOf !== undefined) {
        for (const variant of candidate.anyOf) hydrateClaudeToolSchema(variant);
    }
    if (candidate.type === "object" && candidate.properties === undefined) {
        Object.defineProperty(candidate, "properties", { enumerable: false, value: {} });
    }

    let kind: string;
    if (Object.prototype.hasOwnProperty.call(candidate, "const")) {
        kind = "Literal";
    } else if (candidate.anyOf !== undefined) {
        kind = "Union";
    } else if (candidate.enum !== undefined) {
        kind = "Union";
        const variants = candidate.enum.map((value) => {
            const variant = { const: value } as unknown as TSchema;
            Object.defineProperty(variant, Kind, { value: "Literal" });
            return variant;
        });
        Object.defineProperty(candidate, "anyOf", { enumerable: false, value: variants });
    } else {
        kind = kindForType(candidate.type);
    }
    Object.defineProperty(candidate, Kind, { value: kind });
    return candidate;
}

function kindForType(type: string | undefined): string {
    switch (type) {
        case "array":
            return "Array";
        case "boolean":
            return "Boolean";
        case "integer":
            return "Integer";
        case "null":
            return "Null";
        case "number":
            return "Number";
        case "object":
            return "Object";
        case "string":
            return "String";
        case undefined:
            return "Unknown";
        default:
            throw new Error(`Unsupported Claude tool JSON Schema type '${type}'.`);
    }
}
