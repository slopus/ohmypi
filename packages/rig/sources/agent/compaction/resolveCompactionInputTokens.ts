export function resolveCompactionInputTokens(
    estimatedTokens: number,
    reportedTokens: number | undefined,
): number {
    return Math.max(estimatedTokens, reportedTokens ?? 0);
}
