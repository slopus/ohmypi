export function quoteShellArgument(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
