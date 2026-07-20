import { dirname } from "node:path";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { assertReadBeforeModify } from "../utils/assertReadBeforeModify.js";
import { recordWriteAsRead } from "../utils/recordWriteAsRead.js";

export async function writeGeneratedMediaFile(
    path: string,
    bytes: Uint8Array,
    context: AgentContext,
): Promise<string> {
    const resolvedPath = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
    await assertReadBeforeModify(resolvedPath, context);
    await context.fs.mkdir(dirname(resolvedPath), { recursive: true });
    await context.fs.writeFile(resolvedPath, bytes);
    await recordWriteAsRead(resolvedPath, context);
    return resolvedPath;
}
