import type { TSchema } from "@sinclair/typebox";

export function toJsonSchema(schema: TSchema): Record<string, unknown> {
    return JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
}
