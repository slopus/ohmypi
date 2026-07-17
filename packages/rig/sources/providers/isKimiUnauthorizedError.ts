export function isKimiUnauthorizedError(error: unknown): boolean {
    if (error === null || typeof error !== "object") return false;
    const value = error as { status?: unknown; statusCode?: unknown };
    return [value.status, value.statusCode].some((status) => status === 401 || status === 403);
}
