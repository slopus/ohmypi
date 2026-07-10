export function normalizeMcpName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
