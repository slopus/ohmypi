import { escapeXml } from "../agent/skills/escapeXml.js";
import { truncateTextHead } from "../tools/utils/truncateTextHead.js";

const MAX_COMMAND_BYTES = 16_000;
const MAX_COMMAND_LINES = 100;
const MAX_ERROR_BYTES = 4_000;
const MAX_OUTPUT_BYTES = 40_000;
const MAX_OUTPUT_LINES = 1_000;

export function formatShellCommandContext(result: {
    command: string;
    errorMessage?: string;
    exitCode: number | null;
    output: string;
    timedOut: boolean;
}): string {
    const command = truncateTextHead(escapeXml(result.command), {
        maxBytes: MAX_COMMAND_BYTES,
        maxLines: MAX_COMMAND_LINES,
    });
    const error =
        result.errorMessage === undefined
            ? undefined
            : truncateTextHead(escapeXml(result.errorMessage), {
                  maxBytes: MAX_ERROR_BYTES,
                  maxLines: 100,
              });
    const output = truncateTextHead(escapeXml(result.output), {
        maxBytes: MAX_OUTPUT_BYTES,
        maxLines: MAX_OUTPUT_LINES,
    });

    return [
        "<user_shell_command>",
        "<command>",
        command.content,
        ...(command.truncated ? ["[Command truncated for model context.]"] : []),
        "</command>",
        "<result>",
        `Exit code: ${result.exitCode ?? "unknown"}`,
        ...(result.timedOut ? ["Timed out: yes"] : []),
        ...(error === undefined
            ? []
            : [
                  "Error:",
                  error.content,
                  ...(error.truncated ? ["[Error truncated for model context.]"] : []),
              ]),
        "Output:",
        output.content.length === 0 ? "(no output)" : output.content,
        ...(output.truncated ? ["[Output truncated for model context.]"] : []),
        "</result>",
        "</user_shell_command>",
    ].join("\n");
}
