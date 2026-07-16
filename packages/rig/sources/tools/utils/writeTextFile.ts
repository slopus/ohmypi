import { dirname } from "node:path";

import { Type } from "@sinclair/typebox";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { assertReadBeforeModify } from "./assertReadBeforeModify.js";
import { recordWriteAsRead } from "./recordWriteAsRead.js";

export const writeFileReturnSchema = Type.Object({
    path: Type.String(),
    created: Type.Boolean(),
    bytes: Type.Number(),
});

export interface WriteFileOptions {
    path: string;
    content: string;
    cwd?: string;
}

export interface WriteFileResult {
    path: string;
    created: boolean;
    bytes: number;
}

export async function writeTextFile(
    options: WriteFileOptions,
    context: AgentContext,
): Promise<WriteFileResult> {
    const filePath = resolveFileSystemPath(
        options.path,
        options.cwd ?? context.fs.cwd,
        context.fs.home,
    );
    await assertReadBeforeModify(filePath, context);
    const created = !(await context.fs.exists(filePath));
    await context.fs.mkdir(dirname(filePath), { recursive: true });
    await context.fs.writeFile(filePath, options.content);
    await recordWriteAsRead(filePath, context);

    return {
        path: filePath,
        created,
        bytes: Buffer.byteLength(options.content, "utf8"),
    };
}
