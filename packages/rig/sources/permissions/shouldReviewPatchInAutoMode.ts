import type { AgentContext } from "../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../tools/utils/resolveFileSystemPath.js";
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

    const filePattern = /^\*\*\* (?:Add File|Delete File|Update File|Move to): (.+)$/gmu;
    const paths = [...args.patch.matchAll(filePattern)].flatMap((match) =>
        match[1] === undefined ? [] : [match[1]],
    );
    if (paths.length === 0) return true;
    const checks = await Promise.all(
        paths.map((path) =>
            shouldReviewPathInAutoMode(
                resolveFileSystemPath(path, workdir, context.fs.home),
                context,
                {
                    write: true,
                },
            ),
        ),
    );
    return checks.some(Boolean);
}
