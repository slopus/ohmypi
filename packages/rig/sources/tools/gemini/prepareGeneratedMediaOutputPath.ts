import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { assertReadBeforeModify } from "../utils/assertReadBeforeModify.js";

export async function prepareGeneratedMediaOutputPath(
    path: string,
    context: AgentContext,
): Promise<string> {
    const resolvedPath = resolveFileSystemPath(path, context.fs.cwd, context.fs.home);
    await assertReadBeforeModify(resolvedPath, context);
    return resolvedPath;
}
