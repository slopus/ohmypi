/* Grok Build tool contract, modified for Rig. Copyright 2023-2026 SpaceXAI; Apache-2.0. */
import { Type } from "@sinclair/typebox";

import { defineTool } from "../../agent/types.js";
import { summarizeEscalatedShellAction } from "../../permissions/summarizeEscalatedShellAction.js";
import { summarizeTextOutput, toTextBlocks } from "../utils/index.js";
import { parseShellExplorationPresentation } from "../utils/parseShellExplorationPresentation.js";

export const grokRunTerminalCommandTool = defineTool({
    name: "run_terminal_command",
    label: "run_terminal_command",
    description: `Run a bash command and return its output.

Usage notes:
- You can specify an optional timeout in milliseconds, up to 300000. If not specified, foreground commands time out after 120000ms.
- Use background for long-running commands such as development servers and long builds. It returns a task_id immediately; do not add '&' to the command.
- Output may be truncated before it is returned.`,
    arguments: Type.Object({
        command: Type.String({ description: "The bash command to run." }),
        timeout: Type.Optional(
            Type.Integer({
                description:
                    "Optional timeout in milliseconds (max 300000). Default: 120000. A timeout of 0 disables the timeout for background commands.",
                maximum: 300_000,
                minimum: 0,
            }),
        ),
        description: Type.String({
            description:
                "One sentence explaining why this command needs to run and how it contributes to the goal.",
        }),
        secrets: Type.Optional(
            Type.Array(Type.String(), {
                description:
                    "IDs of attached secret bundles to inject for this command. Use an empty array for none.",
            }),
        ),
        background: Type.Boolean({
            description:
                "Set true for a long-running command. Returns a task_id while the command continues in the background.",
        }),
        sandbox_permissions: Type.Optional(
            Type.Union([Type.Literal("use_default"), Type.Literal("require_escalated")], {
                description:
                    "Request reviewed execution outside the workspace sandbox in Auto mode. Defaults to use_default.",
            }),
        ),
    }),
    returnType: Type.Object({
        text: Type.String(),
        task_id: Type.Optional(Type.String()),
    }),
    autoPermissionInstructions:
        'For run_terminal_command, request full-access execution with sandbox_permissions: "require_escalated". Explain why in the description. Keep sandbox_permissions at "use_default" or omit it for ordinary commands.',
    describeAutoPermissionAction: ({ command }, context) =>
        summarizeEscalatedShellAction({ command, cwd: context.fs.cwd }),
    shouldReviewInAutoMode: ({ sandbox_permissions }) =>
        sandbox_permissions === "require_escalated",
    shouldRunInFullAccessInAutoMode: ({ sandbox_permissions }) =>
        sandbox_permissions === "require_escalated",
    execute: async ({ background, command, secrets, timeout }, context, execution) => {
        if (background) {
            const taskId = await context.bash.startSession({
                command,
                maxOutputBytes: 512_000,
                ...(secrets === undefined ? {} : { secrets }),
                ...(timeout === undefined || timeout === 0 ? {} : { timeoutMs: timeout }),
            });
            return {
                task_id: String(taskId),
                text: `Background command started with task_id ${taskId}.`,
            };
        }

        const result = await context.bash.run({
            command,
            maxOutputBytes: 512_000,
            ...(secrets === undefined ? {} : { secrets }),
            timeoutMs: timeout === undefined || timeout === 0 ? 120_000 : timeout,
            ...(execution.signal === undefined ? {} : { signal: execution.signal }),
        });
        const text = [result.stdout, result.stderr].filter(Boolean).join("\n") || "(no output)";
        if (result.timedOut) throw new Error(`${text}\n\nCommand timed out.`);
        if (result.exitCode !== null && result.exitCode !== 0) {
            throw new Error(`${text}\n\nCommand exited with code ${result.exitCode}.`);
        }
        return { text };
    },
    toCallPresentation: ({ background, command }) =>
        background ? undefined : parseShellExplorationPresentation(command),
    toLLM: (result) => toTextBlocks({ text: result.text }),
    toUI: (result) => summarizeTextOutput(result.text),
    locks: [],
});
