import type { WebSearchInput } from "../claude/webSearch/types.js";

export function createGeminiSearchPrompt(input: WebSearchInput): string {
    const instructions = [`Search the web for: ${input.query}`];
    if (input.allowed_domains !== undefined && input.allowed_domains.length > 0) {
        instructions.push(
            `Only use sources from these domains: ${input.allowed_domains.join(", ")}.`,
        );
    }
    if (input.blocked_domains !== undefined && input.blocked_domains.length > 0) {
        instructions.push(
            `Do not use sources from these domains: ${input.blocked_domains.join(", ")}.`,
        );
    }
    instructions.push("Return a concise synthesis supported by source citations.");
    return instructions.join("\n");
}
