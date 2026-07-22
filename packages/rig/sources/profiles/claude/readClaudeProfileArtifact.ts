import { readFileSync } from "node:fs";

import type { ClaudeToolDefinition } from "./types.js";

export function readClaudeProfilePrompt(stem: string): string {
    return readFileSync(new URL(`./${stem}.md`, import.meta.url), "utf8");
}

export function readClaudeProfileTools(stem: string): readonly ClaudeToolDefinition[] {
    return JSON.parse(
        readFileSync(new URL(`./${stem}.tools.json`, import.meta.url), "utf8"),
    ) as readonly ClaudeToolDefinition[];
}

export function readClaudeGoldenTools(stem: string): readonly ClaudeToolDefinition[] {
    return JSON.parse(
        readFileSync(new URL(`./${stem}.tools.golden.json`, import.meta.url), "utf8"),
    ) as readonly ClaudeToolDefinition[];
}
