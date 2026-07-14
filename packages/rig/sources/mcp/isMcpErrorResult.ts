export function isMcpErrorResult(result: unknown): boolean {
    return (
        typeof result === "object" &&
        result !== null &&
        "isError" in result &&
        result.isError === true
    );
}
