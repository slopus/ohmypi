const CURATED_NAMES = new Map([
    ["openai", "OpenAI"],
    ["posthog", "PostHog"],
]);

export function humanizeMcpServerName(name: string): string {
    const words = name
        .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
        .replace(/[_-]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .toLowerCase();
    if (words.length === 0) return "MCP server";

    return words
        .split(" ")
        .map(
            (word) =>
                CURATED_NAMES.get(word) ??
                word.replace(/^./u, (character) => character.toUpperCase()),
        )
        .join(" ")
        .replace(/\bOpen Ai\b/gu, "OpenAI")
        .replace(/\bPost Hog\b/gu, "PostHog");
}
