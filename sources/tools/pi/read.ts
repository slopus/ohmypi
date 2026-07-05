import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { readFileReturnSchema, readTextFile } from "../utils/index.js";

const DEFAULT_MAX_LINES = 2000;
const DEFAULT_MAX_BYTES = 50 * 1024;

export const piReadTool = defineTool({
  name: "read",
  label: "read",
  description: `Read the contents of a file. Supports text files and images (jpg, png, gif, webp, bmp). Images are sent as attachments. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
  arguments: Type.Object({
    path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
    offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
    limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
  }),
  returnType: readFileReturnSchema,
  execute: async ({ path, offset, limit }, context) => {
    const options: Parameters<typeof readTextFile>[0] = { path };
    if (offset !== undefined) options.offset = offset;
    if (limit !== undefined) options.limit = limit;
    return readTextFile(options, context);
  },
  toLLM: (result) => [
    {
      type: "text",
      text: result.content.length > 0 ? result.content : "(empty file)",
    },
  ],
  toUI: (result) =>
    `Read ${result.path} (${result.returnedLines}/${result.totalLines} lines${result.truncated ? ", truncated" : ""})`,
  locks: [],
});
