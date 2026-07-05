import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { applyPatchText, textOutputSchema, toTextBlocks } from "../utils/index.js";

export const codexApplyPatchTool = defineTool({
  name: "apply_patch",
  label: "apply_patch",
  description: "Use the `apply_patch` tool to edit files. This is a FREEFORM tool, so do not wrap the patch in JSON.",
  arguments: Type.Object({
    patch: Type.String({ description: "Patch content using the *** Begin Patch/End Patch format." }),
    workdir: Type.Optional(Type.String({ description: "Working directory for relative paths." })),
  }),
  returnType: textOutputSchema,
  execute: async ({ patch, workdir }, context) => {
    const result = await applyPatchText(patch, workdir ?? context.fs.cwd, context);
    return {
      text: result.applied ? result.summary : "patch not applied",
    };
  },
  toLLM: toTextBlocks,
  toUI: (result) => result.text === "patch not applied" ? "Patch not applied" : "Applied patch",
  locks: ["apply_patch"],
});
