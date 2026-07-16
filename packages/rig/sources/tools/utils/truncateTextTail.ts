export function truncateTextTail(
    value: string,
    options: { maxBytes: number; maxLines: number },
): {
    content: string;
    outputBytes: number;
    outputLines: number;
    totalBytes: number;
    totalLines: number;
    truncated: boolean;
} {
    const totalBytes = Buffer.byteLength(value, "utf8");
    const lines = value.length === 0 ? [] : value.split("\n");
    if (value.endsWith("\n")) lines.pop();
    const totalLines = lines.length;
    if (totalLines <= options.maxLines && totalBytes <= options.maxBytes) {
        return {
            content: value,
            outputBytes: totalBytes,
            outputLines: totalLines,
            totalBytes,
            totalLines,
            truncated: false,
        };
    }

    const output: string[] = [];
    let outputBytes = 0;
    for (let index = lines.length - 1; index >= 0 && output.length < options.maxLines; index--) {
        const line = lines[index] ?? "";
        const separatorBytes = output.length === 0 ? 0 : 1;
        const lineBytes = Buffer.byteLength(line, "utf8") + separatorBytes;
        if (outputBytes + lineBytes <= options.maxBytes) {
            output.unshift(line);
            outputBytes += lineBytes;
            continue;
        }
        if (output.length === 0) {
            const buffer = Buffer.from(line, "utf8");
            let start = Math.max(0, buffer.length - options.maxBytes);
            while (start < buffer.length && ((buffer[start] ?? 0) & 0xc0) === 0x80) start++;
            const tail = buffer.subarray(start).toString("utf8");
            output.unshift(tail);
            outputBytes = Buffer.byteLength(tail, "utf8");
        }
        break;
    }

    const content = output.join("\n");
    return {
        content,
        outputBytes: Buffer.byteLength(content, "utf8"),
        outputLines: output.length,
        totalBytes,
        totalLines,
        truncated: true,
    };
}
