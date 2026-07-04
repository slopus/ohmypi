import { Bash, type InitialFiles } from "just-bash";
import type { Static, TSchema } from "@sinclair/typebox";

import type {
  AgentContext,
  AgentFileStat,
} from "../../agent/context.js";
import type {
  AnyDefinedTool,
  DefinedTool,
} from "../../agent/types.js";

export interface ToolHarnessOptions {
  cwd?: string;
  files?: InitialFiles;
}

export interface ToolTestHarness {
  bash: Bash;
  context: AgentContext;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  runTool<TArgsSchema extends TSchema, TReturnSchema extends TSchema>(
    tool: DefinedTool<TArgsSchema, TReturnSchema>,
    args: Static<TArgsSchema>,
  ): Promise<Static<TReturnSchema>>;
  runToolByName(
    tools: readonly AnyDefinedTool[],
    name: string,
    args: unknown,
  ): Promise<unknown>;
}

export function createJustBashToolHarness(
  options: ToolHarnessOptions = {},
): ToolTestHarness {
  const cwd = options.cwd ?? "/workspace";
  const bashOptions: ConstructorParameters<typeof Bash>[0] = {
    cwd,
  };
  if (options.files !== undefined) bashOptions.files = options.files;
  const bash = new Bash(bashOptions);

  const context: AgentContext = {
    fs: {
      cwd,
      async exists(path) {
        return bash.fs.exists(path);
      },
      async mkdir(path, mkdirOptions) {
        await bash.fs.mkdir(path, mkdirOptions);
      },
      async readFile(path) {
        return bash.fs.readFile(path);
      },
      async readFileBuffer(path) {
        return bash.fs.readFileBuffer(path);
      },
      async readdir(path) {
        return bash.fs.readdir(path);
      },
      async rm(path, rmOptions) {
        await bash.fs.rm(path, rmOptions);
      },
      async stat(path) {
        const stats = await bash.fs.stat(path);
        return toAgentFileStat(stats);
      },
      async writeFile(path, content) {
        await bash.fs.writeFile(path, content);
      },
    },
    bash: {
      cwd,
      async run(runOptions) {
        const controller = new AbortController();
        const timeout =
          runOptions.timeoutMs === undefined
            ? undefined
            : setTimeout(() => controller.abort(), runOptions.timeoutMs);
        const abort = () => controller.abort();
        runOptions.signal?.addEventListener("abort", abort, { once: true });

        try {
          const result = await bash.exec(runOptions.command, {
            cwd: runOptions.cwd ?? cwd,
            signal: controller.signal,
          });
          return {
            stdout: capOutput(result.stdout, runOptions.maxOutputBytes),
            stderr: capOutput(result.stderr, runOptions.maxOutputBytes),
            exitCode: result.exitCode,
            timedOut: controller.signal.aborted,
          };
        } finally {
          if (timeout !== undefined) clearTimeout(timeout);
          runOptions.signal?.removeEventListener("abort", abort);
        }
      },
    },
  };

  return {
    bash,
    context,
    readFile(path) {
      return context.fs.readFile(path);
    },
    writeFile(path, content) {
      return context.fs.writeFile(path, content);
    },
    async runTool<TArgsSchema extends TSchema, TReturnSchema extends TSchema>(
      tool: DefinedTool<TArgsSchema, TReturnSchema>,
      args: Static<TArgsSchema>,
    ): Promise<Static<TReturnSchema>> {
      return tool.execute(args, context);
    },
    async runToolByName(tools, name, args) {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const execute = tool.execute as (
        args: unknown,
        context: AgentContext,
      ) => Promise<unknown> | unknown;
      return execute(args, context);
    },
  };
}

function toAgentFileStat(stats: {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
  mtime: Date;
}): AgentFileStat {
  return {
    isFile: stats.isFile,
    isDirectory: stats.isDirectory,
    isSymbolicLink: stats.isSymbolicLink,
    size: stats.size,
    mtimeMs: stats.mtime.getTime(),
  };
}

function capOutput(value: string, maxBytes: number | undefined): string {
  if (maxBytes === undefined) {
    return value;
  }

  const buffer = Buffer.from(value);
  return buffer.length <= maxBytes ? value : buffer.subarray(0, maxBytes).toString("utf8");
}
