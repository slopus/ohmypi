export function truncateLine(
    line: string,
    maxChars: number,
): { text: string; wasTruncated: boolean } {
    const characters = [...line];
    if (characters.length <= maxChars) return { text: line, wasTruncated: false };
    return {
        text: `${characters.slice(0, maxChars).join("")}... [truncated]`,
        wasTruncated: true,
    };
}
