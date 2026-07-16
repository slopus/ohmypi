import { Type } from "@sinclair/typebox";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { splitLines } from "./path.js";

export const readFileReturnSchema = Type.Object({
    path: Type.String(),
    content: Type.String(),
    startLine: Type.Number(),
    totalLines: Type.Number(),
    returnedLines: Type.Number(),
    truncated: Type.Boolean(),
});

export interface ReadFileOptions {
    path: string;
    offset?: number;
    limit?: number;
    cwd?: string;
    numbered?: boolean;
}

export interface ReadFileResult {
    path: string;
    content: string;
    startLine: number;
    totalLines: number;
    returnedLines: number;
    truncated: boolean;
}

export async function readTextFile(
    options: ReadFileOptions,
    context: AgentContext,
): Promise<ReadFileResult> {
    const filePath = resolveFileSystemPath(
        options.path,
        options.cwd ?? context.fs.cwd,
        context.fs.home,
    );
    const stats = await context.fs.stat(filePath);
    if (stats.isDirectory) {
        throw new Error(`Path is a directory: ${options.path}`);
    }

    const raw = await context.fs.readFile(filePath);
    context.fileReads?.recordRead(filePath, stats.mtimeMs);
    const lines = splitLines(raw);
    const startLine = Math.max(1, options.offset ?? 1);
    const startIndex = Math.min(lines.length, startLine - 1);
    const limit = options.limit === undefined ? undefined : Math.max(0, options.limit);
    const selected =
        limit === undefined ? lines.slice(startIndex) : lines.slice(startIndex, startIndex + limit);
    const content = options.numbered
        ? selected.map((line, index) => `${startLine + index}\t${line}`).join("\n")
        : selected.join("\n");

    return {
        path: filePath,
        content,
        startLine,
        totalLines: lines.length,
        returnedLines: selected.length,
        truncated: limit !== undefined && startIndex + selected.length < lines.length,
    };
}
