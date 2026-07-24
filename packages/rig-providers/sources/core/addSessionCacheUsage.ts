import type { SessionCacheUsage } from "@/core/SessionCacheUsage.js";

export function addSessionCacheUsage(
    left: SessionCacheUsage | undefined,
    right: SessionCacheUsage | undefined,
): SessionCacheUsage | undefined {
    if (left === undefined) return right;
    if (right === undefined) return left;
    const input = left.input + right.input;
    const output = left.output + right.output;
    const cacheRead = left.cacheRead + right.cacheRead;
    const cacheWrite = left.cacheWrite + right.cacheWrite;
    return {
        input,
        output,
        cacheRead,
        cacheWrite,
        totalTokens: input + output + cacheRead + cacheWrite,
    };
}
