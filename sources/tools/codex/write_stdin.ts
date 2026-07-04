import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { textOutputSchema, toTextBlocks } from "../utils/index.js";

export const codexWriteStdinTool = defineTool({
  name: "write_stdin",
  label: "write_stdin",
  description: "Writes characters to an existing unified exec session and returns recent output.",
  arguments: Type.Object({
    session_id: Type.Number({ description: "Identifier of the running unified exec session." }),
    chars: Type.Optional(Type.String({ description: "Bytes to write to stdin. Defaults to empty, which polls without writing." })),
    yield_time_ms: Type.Optional(Type.Number({ description: "Wait before yielding output. Non-empty writes default to 250 ms and cap at 30000 ms; empty polls wait 5000-300000 ms by default." })),
    max_output_tokens: Type.Optional(Type.Number({ description: "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy." })),
  }),
  returnType: textOutputSchema,
  execute: ({ session_id }) => ({
    text: `No active Codex unified exec session ${session_id}; this implementation runs exec_command to completion.`,
  }),
  toLLM: toTextBlocks,
  locks: [],
});
