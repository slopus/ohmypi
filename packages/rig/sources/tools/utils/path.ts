import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export function resolveToolPath(path: string, cwd: string): string {
    if (path.startsWith("~/")) {
        return resolve(process.env.HOME ?? cwd, path.slice(2));
    }

    return isAbsolute(path) ? path : resolve(cwd, path);
}

export function splitLines(content: string): string[] {
    if (content.length === 0) {
        return [];
    }
    return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function temporaryFilePath(prefix: string): string {
    return join(tmpdir(), `${prefix}-${process.pid}-${Date.now()}`);
}
