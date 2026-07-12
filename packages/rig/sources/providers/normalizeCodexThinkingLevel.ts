export function normalizeCodexThinkingLevel(level: string): string {
    return level === "max" || level === "ultra" ? "xhigh" : level;
}
