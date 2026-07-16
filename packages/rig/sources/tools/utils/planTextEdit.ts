import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import type { EditFileOptions, TextEditPlan } from "./editFileTypes.js";
import { planTextEditInContent } from "./planTextEditInContent.js";

export async function planTextEdit(
    options: EditFileOptions,
    context: AgentContext,
): Promise<TextEditPlan> {
    const filePath = resolveFileSystemPath(
        options.path,
        options.cwd ?? context.fs.cwd,
        context.fs.home,
    );
    const content = await context.fs.readFile(filePath);
    return planTextEditInContent(content, filePath, options);
}
