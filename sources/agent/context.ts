import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";

export interface AgentFileStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size: number;
  mtimeMs: number;
}

export interface AgentFileSystem {
  cwd: string;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readFile(path: string): Promise<string>;
  readFileBuffer(path: string): Promise<Uint8Array>;
  readdir(path: string): Promise<readonly string[]>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  stat(path: string): Promise<AgentFileStat>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
}

export interface AgentBashRunOptions {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

export interface AgentBashRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface AgentBash {
  cwd: string;
  run(options: AgentBashRunOptions): Promise<AgentBashRunResult>;
}

export interface AgentContext {
  fs: AgentFileSystem;
  bash: AgentBash;
}

export function createNodeAgentContext(cwd: string): AgentContext {
  return {
    fs: createNodeFileSystem(cwd),
    bash: createNodeBash(cwd),
  };
}

function createNodeFileSystem(cwd: string): AgentFileSystem {
  return {
    cwd,
    async exists(path) {
      return existsSync(path);
    },
    async mkdir(path, options) {
      await mkdir(path, { recursive: options?.recursive ?? false });
    },
    async readFile(path) {
      return readFile(path, "utf8");
    },
    async readFileBuffer(path) {
      return readFile(path);
    },
    async readdir(path) {
      return readdir(path);
    },
    async rm(path, options) {
      await rm(path, {
        recursive: options?.recursive ?? false,
        force: options?.force ?? false,
      });
    },
    async stat(path) {
      const stats = await stat(path);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink(),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    },
    async writeFile(path, content) {
      await writeFile(path, content);
    },
  };
}

function createNodeBash(cwd: string): AgentBash {
  return {
    cwd,
    run(options) {
      return new Promise((resolvePromise, reject) => {
        const child = spawn(process.env.SHELL ?? "/bin/sh", ["-lc", options.command], {
          cwd: options.cwd ?? cwd,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const timeoutMs = options.timeoutMs ?? 120_000;
        const maxOutputBytes = options.maxOutputBytes ?? 512_000;
        let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
        let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs);
        const abort = () => {
          timedOut = true;
          child.kill("SIGTERM");
        };

        options.signal?.addEventListener("abort", abort, { once: true });
        child.stdout.on("data", (chunk: Buffer) => {
          stdout = appendCapped(stdout, chunk, maxOutputBytes);
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr = appendCapped(stderr, chunk, maxOutputBytes);
        });
        child.on("error", reject);
        child.on("close", (exitCode) => {
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", abort);
          resolvePromise({
            stdout: stdout.toString("utf8"),
            stderr: stderr.toString("utf8"),
            exitCode,
            timedOut,
          });
        });
      });
    },
  };
}

function appendCapped(
  buffer: Buffer<ArrayBufferLike>,
  chunk: Buffer,
  maxBytes: number,
): Buffer<ArrayBufferLike> {
  const combined = Buffer.concat([buffer, chunk]);
  return combined.length <= maxBytes ? combined : combined.subarray(0, maxBytes);
}
