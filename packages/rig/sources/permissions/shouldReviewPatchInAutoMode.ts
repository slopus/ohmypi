import type { AgentContext } from "../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../agent/context/resolveFileSystemPath.js";
import { parsePatchPathDirective } from "../patch/parsePatchPathDirective.js";
import { shouldReviewPathInAutoMode } from "./shouldReviewPathInAutoMode.js";

export async function shouldReviewPatchInAutoMode(
    args: { patch: string; workdir?: string },
    context: AgentContext,
): Promise<boolean> {
    let workdir: string;
    try {
        workdir = resolveFileSystemPath(
            args.workdir ?? context.fs.cwd,
            context.fs.cwd,
            context.fs.home,
        );
    } catch {
        return true;
    }
    if (await shouldReviewPathInAutoMode(workdir, context, { write: false })) return true;

    const paths = args.patch
        .replace(/\r\n/g, "\n")
        .split("\n")
        .flatMap((line) => {
            const directive = parsePatchPathDirective(line);
            return directive === undefined ? [] : [directive.path];
        });
    if (paths.length === 0) return true;
    try {
        for (const path of paths) {
            const resolvedPath = resolveFileSystemPath(path, workdir, context.fs.home);
            if (await shouldReviewPathInAutoMode(resolvedPath, context, { write: true })) {
                return true;
            }
        }
        return false;
    } catch {
        return true;
    }
}
