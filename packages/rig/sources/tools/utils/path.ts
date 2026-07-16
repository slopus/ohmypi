import { tmpdir } from "node:os";
import { join } from "node:path";

export function splitLines(content: string): string[] {
    if (content.length === 0) {
        return [];
    }
    return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function temporaryFilePath(prefix: string): string {
    return join(tmpdir(), `${prefix}-${process.pid}-${Date.now()}`);
}
