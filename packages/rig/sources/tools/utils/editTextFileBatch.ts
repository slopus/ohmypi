import type { AgentContext } from "../../agent/context/AgentContext.js";
import { resolveFileSystemPath } from "../../agent/context/resolveFileSystemPath.js";
import { assertReadBeforeModify } from "./assertReadBeforeModify.js";
import type {
    BatchEditFileOptions,
    BatchEditFileResult,
    EditFileOptions,
} from "./editFileTypes.js";
import { findEditMatch } from "./findEditMatch.js";
import { preserveQuoteStyle } from "./preserveQuoteStyle.js";
import { recordWriteAsRead } from "./recordWriteAsRead.js";

export type { BatchEdit, BatchEditFileOptions, BatchEditFileResult } from "./editFileTypes.js";

export async function editTextFileBatch(
    options: BatchEditFileOptions,
    context: AgentContext,
): Promise<BatchEditFileResult> {
    if (options.edits.length === 0) {
        throw new Error("At least one edit is required.");
    }
    const emptyEditIndex = options.edits.findIndex((edit) => edit.oldText.length === 0);
    if (emptyEditIndex !== -1) {
        throw new Error(`oldText for edit ${emptyEditIndex + 1} must not be empty.`);
    }

    const filePath = resolveFileSystemPath(
        options.path,
        options.cwd ?? context.fs.cwd,
        context.fs.home,
    );
    await assertReadBeforeModify(filePath, context);
    const rawContent = await context.fs.readFile(filePath);
    const matches = options.edits.map((edit, editIndex) => {
        const editOptions: EditFileOptions = {
            path: options.path,
            oldString: edit.oldText,
            newString: edit.newText,
        };
        if (options.fuzzy !== undefined) editOptions.fuzzy = options.fuzzy;
        const match = findEditMatch(rawContent, editOptions);
        if (match === undefined) {
            throw new Error(
                options.edits.length === 1
                    ? `Could not find the exact text in ${options.path}. The old text must match exactly including all whitespace and newlines.`
                    : `Could not find the exact text for edit ${editIndex + 1} in ${options.path}.`,
            );
        }
        return { ...match, edit };
    });

    const sorted = [...matches].sort((left, right) => left.start - right.start);
    for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (previous && current && current.start < previous.end) {
            throw new Error("Edit ranges overlap. Merge nearby changes into one edit.");
        }
    }

    let nextContent = rawContent;
    let usedFuzzy = false;
    for (let index = sorted.length - 1; index >= 0; index--) {
        const match = sorted[index];
        if (!match) continue;
        usedFuzzy ||= match.fuzzy;
        const actualOldString = rawContent.slice(match.start, match.end);
        const nextString = preserveQuoteStyle(
            match.edit.oldText,
            actualOldString,
            match.edit.newText,
        );
        nextContent = nextContent.slice(0, match.start) + nextString + nextContent.slice(match.end);
    }

    await context.fs.writeFile(filePath, nextContent);
    await recordWriteAsRead(filePath, context);
    return {
        path: filePath,
        replacements: sorted.length,
        fuzzy: usedFuzzy,
    };
}
