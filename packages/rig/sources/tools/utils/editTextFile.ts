import { Type } from "@sinclair/typebox";

import type { AgentContext } from "../../agent/context/AgentContext.js";
import { assertReadBeforeModify } from "./assertReadBeforeModify.js";
import type { EditFileOptions, EditFileResult } from "./editFileTypes.js";
import { planTextEdit } from "./planTextEdit.js";
import { recordWriteAsRead } from "./recordWriteAsRead.js";

export type { EditFileOptions, EditFileResult } from "./editFileTypes.js";

export const editFileReturnSchema = Type.Object({
    path: Type.String(),
    replacements: Type.Number(),
    fuzzy: Type.Boolean(),
    oldString: Type.String(),
    newString: Type.String(),
});

export async function editTextFile(
    options: EditFileOptions,
    context: AgentContext,
): Promise<EditFileResult> {
    const plan = await planTextEdit(options, context);
    await assertReadBeforeModify(plan.path, context);
    await context.fs.writeFile(plan.path, plan.nextContent);
    await recordWriteAsRead(plan.path, context);

    return {
        path: plan.path,
        replacements: plan.replacements,
        fuzzy: plan.fuzzy,
        oldString: options.oldString,
        newString: options.newString,
    };
}
