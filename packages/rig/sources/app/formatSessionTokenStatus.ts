import type { Usage } from "@slopus/rig-execution";

import { formatCompactTokens } from "./formatCompactTokens.js";

export function formatSessionTokenStatus(options: {
    contextTokens: number;
    contextWindow?: number;
    usage: Usage;
}): string {
    // Cache writes and uncached input are misses; output tokens are not cache-eligible input.
    const cacheReadTokens = Math.max(0, options.usage.cacheRead);
    const cacheEligibleTokens =
        Math.max(0, options.usage.input) + cacheReadTokens + Math.max(0, options.usage.cacheWrite);
    const cacheHitPercent =
        cacheEligibleTokens <= 0
            ? 0
            : Math.min(100, Math.round((cacheReadTokens / cacheEligibleTokens) * 100));
    const parts = [
        `${formatCompactTokens(options.usage.totalTokens)} tokens`,
        `${cacheHitPercent}% cache hit`,
    ];
    if (options.contextWindow !== undefined && options.contextWindow > 0) {
        const contextLeftPercent = Math.min(
            100,
            Math.max(0, Math.round((1 - options.contextTokens / options.contextWindow) * 100)),
        );
        parts.push(`${contextLeftPercent}% ctx left`);
    }
    return parts.join(" · ");
}
