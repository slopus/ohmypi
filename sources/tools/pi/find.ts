import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { globFiles, textOutputSchema, toTextBlocks } from "../utils/index.js";

const DEFAULT_LIMIT = 1000;
const DEFAULT_MAX_BYTES = 50 * 1024;

export const piFindTool = defineTool({
  name: "find",
  label: "find",
  description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
  arguments: Type.Object({
    pattern: Type.String({
      description: "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
    }),
    path: Type.Optional(Type.String({ description: "Directory to search in (default: current directory)" })),
    limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 1000)" })),
  }),
  returnType: textOutputSchema,
  execute: async ({ pattern, path, limit }, context) => {
    const options: Parameters<typeof globFiles>[0] = { pattern, limit: limit ?? DEFAULT_LIMIT };
    if (path !== undefined) options.path = path;
    const files = await globFiles(options, context);
    return { text: files.length > 0 ? files.join("\n") : "No files found matching pattern" };
  },
  toLLM: toTextBlocks,
  locks: [],
});
