import { describe, expect, it } from "vitest";

import {
    kimiAgentTool,
    kimiCodeTools,
    kimiGoalTools,
    kimiSendMessageTool,
} from "../tools/kimi/index.js";
import { normalizeKimiToolSchema } from "./normalizeKimiToolSchema.js";

const allKimiTools = [...kimiCodeTools, kimiAgentTool, kimiSendMessageTool, ...kimiGoalTools];

describe("normalizeKimiToolSchema", () => {
    it("keeps the type on anyOf items instead of the parent, as Moonshot requires", () => {
        const normalized = normalizeKimiToolSchema({
            properties: {
                output_mode: {
                    anyOf: [{ const: "content" }, { const: "files_with_matches" }],
                    description: "Return matching content or file paths.",
                },
            },
            type: "object",
        });

        expect(normalized.properties).toMatchObject({
            output_mode: {
                anyOf: [
                    { const: "content", type: "string" },
                    { const: "files_with_matches", type: "string" },
                ],
            },
        });
        expect((normalized.properties as Record<string, object>).output_mode).not.toHaveProperty(
            "type",
        );
    });

    it("produces Moonshot-valid schemas for every real Kimi tool", () => {
        for (const tool of allKimiTools) {
            const normalized = normalizeKimiToolSchema(tool.arguments as Record<string, unknown>);
            expect(collectMoonshotViolations(normalized, tool.name), `tool ${tool.name}`).toEqual(
                [],
            );
        }
    });
});

function collectMoonshotViolations(node: unknown, path: string): string[] {
    if (node === null || typeof node !== "object") return [];
    if (Array.isArray(node)) {
        return node.flatMap((child, index) =>
            collectMoonshotViolations(child, `${path}[${index}]`),
        );
    }
    const record = node as Record<string, unknown>;
    const violations: string[] = [];
    for (const key of ["anyOf", "oneOf", "allOf"]) {
        const children = record[key];
        if (!Array.isArray(children)) continue;
        if (record.type !== undefined) {
            violations.push(`${path}: type must live on ${key} items, not the parent`);
        }
        for (const [index, child] of children.entries()) {
            const item = child as Record<string, unknown>;
            if (item.type === undefined && !Array.isArray(item.anyOf)) {
                violations.push(`${path}.${key}[${index}]: item is missing a type`);
            }
        }
    }
    return violations.concat(
        Object.entries(record).flatMap(([key, value]) =>
            collectMoonshotViolations(value, `${path}.${key}`),
        ),
    );
}
