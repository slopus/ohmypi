import type { Usage } from "../providers/types.js";

export function createdContextTokens(usage: Usage): number {
    return Math.max(0, usage.totalTokens - usage.cacheRead);
}
