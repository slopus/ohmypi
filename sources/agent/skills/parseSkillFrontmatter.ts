import { parse } from "yaml";

import type { SkillFrontmatter } from "./SkillFrontmatter.js";

export interface ParsedSkillMarkdown {
    frontmatter: SkillFrontmatter;
    body: string;
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseSkillFrontmatter(content: string): ParsedSkillMarkdown {
    const match = FRONTMATTER_PATTERN.exec(content);
    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const rawFrontmatter = match[1] ?? "";

    return {
        frontmatter: coerceSkillFrontmatter(parse(rawFrontmatter)),
        body: content.slice(match[0].length),
    };
}

function coerceSkillFrontmatter(value: unknown): SkillFrontmatter {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const record = value as Record<string, unknown>;
    return {
        ...(typeof record.name === "string" ? { name: record.name } : {}),
        ...(typeof record.description === "string" ? { description: record.description } : {}),
        ...(typeof record["disable-model-invocation"] === "boolean"
            ? { "disable-model-invocation": record["disable-model-invocation"] }
            : {}),
    };
}
