import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import {
  mediaTypeForPath,
  readFileReturnSchema,
  readTextFile,
  textOutputSchema,
} from "../utils/index.js";

const MAX_LINES_TO_READ = 2000;

const CLAUDE_READ_DESCRIPTION = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to ${MAX_LINES_TO_READ} lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Results are returned using cat -n format, with line numbers starting at 1
- This tool allows Claude Code to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as Claude Code is a multimodal LLM.
- This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.
- This tool can only read files, not directories. To read a directory, use an ls command via the Bash tool.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot, ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`;

const claudeReadReturnSchema = Type.Union([
  readFileReturnSchema,
  Type.Object({
    image_url: Type.String(),
    mediaType: Type.String(),
  }),
  textOutputSchema,
]);

export const claudeReadTool = defineTool({
  name: "Read",
  label: "Read",
  description: CLAUDE_READ_DESCRIPTION,
  arguments: Type.Object({
    file_path: Type.String({ description: "The absolute path to the file to read" }),
    offset: Type.Optional(
      Type.Number({
        description: "The line number to start reading from. Only provide if the file is too large to read at once",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "The number of lines to read. Only provide if the file is too large to read at once.",
      }),
    ),
  }),
  returnType: claudeReadReturnSchema,
  execute: async ({ file_path, offset, limit }, context) => {
    const lower = file_path.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp)$/.test(lower)) {
      const mediaType = mediaTypeForPath(file_path);
      const data = Buffer.from(await context.fs.readFileBuffer(file_path)).toString("base64");
      return {
        image_url: `data:${mediaType};base64,${data}`,
        mediaType,
      };
    }

    const options: Parameters<typeof readTextFile>[0] = {
      path: file_path,
      numbered: true,
    };
    if (offset !== undefined) options.offset = offset;
    if (limit !== undefined) options.limit = limit;
    return readTextFile(options, context);
  },
  toLLM: (result) => {
    if ("image_url" in result) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(result.image_url);
      return match
        ? [{ type: "image", mediaType: match[1] ?? result.mediaType, data: match[2] ?? "" }]
        : [{ type: "text", text: result.image_url }];
    }

    if ("content" in result) {
      return [{ type: "text", text: result.content.length > 0 ? result.content : "(empty file)" }];
    }

    return [{ type: "text", text: result.text }];
  },
  toUI: (result, args) => {
    if ("image_url" in result) {
      return `Read image ${args.file_path}`;
    }
    if ("content" in result) {
      return `Read ${result.path} (${result.returnedLines}/${result.totalLines} lines${result.truncated ? ", truncated" : ""})`;
    }
    return result.text;
  },
  locks: [],
});
