/** Turns a raw effort level id (e.g. "medium") into a readable label. */
export function humanizeEffort(effort: string): string {
    return effort.replace(/[-_]+/g, " ").replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
