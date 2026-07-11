import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { editTextFileBatch } from "../utils/index.js";

const editItemSchema = Type.Object(
    {
        oldText: Type.String({
            description:
                "Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
        }),
        newText: Type.String({ description: "Replacement text for this targeted edit." }),
    },
    {},
);

const piEditReturnSchema = Type.Object({
    path: Type.String(),
    replacements: Type.Number(),
    fuzzy: Type.Boolean(),
});

export const piEditTool = defineTool({
    name: "edit",
    label: "edit",
    description:
        "Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.",
    arguments: Type.Object(
        {
            path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
            edits: Type.Optional(
                Type.Array(editItemSchema, {
                    description:
                        "One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.",
                }),
            ),
            oldText: Type.Optional(Type.String()),
            newText: Type.Optional(Type.String()),
        },
        {},
    ),
    returnType: piEditReturnSchema,
    execute: async (args, context) => {
        const edits = normalizePiEdits(args);
        return editTextFileBatch(
            {
                path: args.path,
                edits,
                fuzzy: true,
            },
            context,
        );
    },
    toLLM: (result) => [
        {
            type: "text",
            text: `Successfully replaced ${result.replacements} block(s) in ${result.path}.`,
        },
    ],
    toUI: (result) =>
        `Edited ${result.path} (${result.replacements} replacement${result.replacements === 1 ? "" : "s"})`,
    locks: [(args) => args.path],
});

function normalizePiEdits(args: {
    edits?: readonly { oldText: string; newText: string }[] | string;
    oldText?: string;
    newText?: string;
}): readonly { oldText: string; newText: string }[] {
    const edits: { oldText: string; newText: string }[] = [];
    if (typeof args.edits === "string") {
        const parsed: unknown = JSON.parse(args.edits);
        if (Array.isArray(parsed)) {
            for (const edit of parsed) {
                if (
                    edit &&
                    typeof edit === "object" &&
                    typeof (edit as { oldText?: unknown }).oldText === "string" &&
                    typeof (edit as { newText?: unknown }).newText === "string"
                ) {
                    edits.push({
                        oldText: (edit as { oldText: string }).oldText,
                        newText: (edit as { newText: string }).newText,
                    });
                }
            }
        }
    } else if (Array.isArray(args.edits)) {
        edits.push(...args.edits);
    }

    if (typeof args.oldText === "string" && typeof args.newText === "string") {
        edits.push({ oldText: args.oldText, newText: args.newText });
    }

    if (edits.length === 0) {
        throw new Error("edit requires edits[] or oldText/newText.");
    }
    return edits;
}
