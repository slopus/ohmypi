import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { countTextLines, resolveToolPath, textOutputSchema, toTextBlocks } from "../utils/index.js";

const DEFAULT_LIMIT = 500;
const DEFAULT_MAX_BYTES = 50 * 1024;

export const piLsTool = defineTool({
    name: "ls",
    label: "ls",
    description: `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LIMIT} entries or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
    arguments: Type.Object({
        path: Type.Optional(
            Type.String({ description: "Directory to list (default: current directory)" }),
        ),
        limit: Type.Optional(
            Type.Number({ description: "Maximum number of entries to return (default: 500)" }),
        ),
    }),
    returnType: textOutputSchema,
    execute: async ({ path, limit }, context) => {
        const dirPath = resolveToolPath(path || ".", context.fs.cwd);
        const entries = [...(await context.fs.readdir(dirPath))];
        entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        const output: string[] = [];
        for (const entry of entries.slice(0, limit ?? DEFAULT_LIMIT)) {
            const entryStats = await context.fs.stat(resolveToolPath(entry, dirPath));
            output.push(entryStats.isDirectory ? `${entry}/` : entry);
        }
        return { text: output.length > 0 ? output.join("\n") : "(empty directory)" };
    },
    toLLM: toTextBlocks,
    toUI: (result, args) =>
        result.text === "(empty directory)"
            ? `Listed ${args.path ?? "."} (empty)`
            : `Listed ${args.path ?? "."} (${countTextLines(result.text)} entries)`,
    locks: [],
});
