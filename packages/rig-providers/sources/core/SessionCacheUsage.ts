export interface SessionCacheUsage {
    readonly input: number;
    readonly output: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    readonly totalTokens: number;
}

export const EMPTY_SESSION_CACHE_USAGE: SessionCacheUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
};
